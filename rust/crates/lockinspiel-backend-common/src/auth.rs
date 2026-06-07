use axum::{
    extract::{FromRef, FromRequestParts, OptionalFromRequestParts},
    http::StatusCode,
};
use axum_extra::{
    TypedHeader,
    headers::{Authorization, authorization::Bearer},
    typed_header::TypedHeaderRejection,
};
use diesel::{declare_sql_function, sql_types};
use diesel_async::{
    AsyncPgConnection, RunQueryDsl,
    pooled_connection::bb8::{self, RunError},
};
use jsonwebtoken::{DecodingKey, TokenData, Validation};
use thiserror::Error;
use tracing::instrument;
use uuid::Uuid;

use crate::{
    ApiState,
    error::{AsStatusCode, Error, WithReason},
    users::UserClaims,
};

#[declare_sql_function]
extern "SQL" {
    #[sql_name = "\"user\".uid"]
    fn uid() -> sql_types::Uuid;
    #[sql_name = "\"user\".set_uid"]
    fn set_uid(uid: sql_types::Uuid) -> sql_types::Text;
}

pub static JWT_ALG: jsonwebtoken::Algorithm = jsonwebtoken::Algorithm::ES256;

#[derive(Clone)]
pub struct Pool(bb8::Pool<AsyncPgConnection>);

impl Pool {
    pub fn new(pool: bb8::Pool<AsyncPgConnection>) -> Self {
        Self(pool)
    }

    // fn get(
    //     &self,
    // ) -> impl Future<Output = Result<bb8::PooledConnection<'_, AsyncPgConnection>, RunError>> {
    //     self.0.get()
    // }

    fn get_owned(
        &self,
    ) -> impl Future<Output = Result<bb8::PooledConnection<'static, AsyncPgConnection>, RunError>>
    {
        self.0.get_owned()
    }
}

pub struct DatabaseConnection {
    pub connection: bb8::PooledConnection<'static, AsyncPgConnection>,
    pub user: Option<UserClaims>,
}

impl DatabaseConnection {
    async fn new(
        mut connection: bb8::PooledConnection<'static, AsyncPgConnection>,
    ) -> Result<Self, Error<ErrorKind>> {
        diesel::sql_query("SET ROLE authenticator")
            .execute(&mut connection)
            .await
            .with_reason("Failed to switch into authenticator role")?;

        Ok(Self {
            connection,
            user: None,
        })
    }

    async fn set_uid(&mut self, user: Option<UserClaims>) -> Result<(), Error<ErrorKind>> {
        if let Some(user) = &user {
            diesel::sql_query("SET ROLE authenticated")
                .execute(&mut self.connection)
                .await
                .with_reason("Failed to switch into authenticated role")?;
            diesel::select(set_uid(user.sub))
                .execute(&mut self.connection)
                .await
                .with_reason("Failed to pass user ID to database")?;
        } else {
            diesel::sql_query("SET ROLE anon")
                .execute(&mut self.connection)
                .await
                .with_reason("Failed to switch into anon role")?;
            diesel::select(set_uid(Uuid::nil()))
                .execute(&mut self.connection)
                .await
                .with_reason("Failed to unset user ID in database")?;
        }

        self.user = user;

        Ok(())
    }

    pub async fn login_user_with_access_token(
        &mut self,
        token: impl AsRef<[u8]>,
        decoding_key: &DecodingKey,
    ) -> Result<(), Error<ErrorKind>> {
        let token: TokenData<UserClaims> =
            jsonwebtoken::decode(token, decoding_key, &Validation::new(JWT_ALG))
                .with_reason("Failed to decode JWT token")?;

        self.set_uid(Some(token.claims)).await?;

        Ok(())
    }

    pub async fn login_as_anon(&mut self) -> Result<(), Error<ErrorKind>> {
        self.set_uid(None).await
    }

    pub fn user(&self) -> Option<&UserClaims> {
        self.user.as_ref()
    }
}

impl std::ops::DerefMut for DatabaseConnection {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.connection
    }
}

impl std::ops::Deref for DatabaseConnection {
    type Target = bb8::PooledConnection<'static, AsyncPgConnection>;

    fn deref(&self) -> &Self::Target {
        &self.connection
    }
}

#[derive(Error, Debug)]
pub enum ErrorKind {
    #[error("Failed to get connection to database")]
    DbConnectionError(#[from] RunError),
    #[error("An IO error occurred")]
    IOError(#[from] std::io::Error),
    #[error("Failed to parse header")]
    ParseHeader(#[from] TypedHeaderRejection),
    #[error("The database encountered an error")]
    DieselError(#[from] diesel::result::Error),
    #[error("An error occurred while processing a JWT")]
    JWTError(#[from] jsonwebtoken::errors::Error),
    #[error("A reqwest error occurred")]
    ReqwestError(#[from] reqwest::Error),
    #[error("An error occurred while pulling the KID out of a JWT")]
    KIDError,
}

impl AsStatusCode for ErrorKind {
    fn status_code(&self) -> StatusCode {
        match self {
            ErrorKind::DbConnectionError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorKind::IOError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorKind::ParseHeader(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorKind::DieselError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::JWTError(_) => StatusCode::UNAUTHORIZED,
            Self::ReqwestError(r) => r.status().unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            Self::KIDError => StatusCode::UNPROCESSABLE_ENTITY,
        }
    }
}

impl<S> FromRequestParts<S> for DatabaseConnection
where
    ApiState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = Error<ErrorKind>;

    #[instrument(skip_all)]
    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &S,
    ) -> Result<Self, Self::Rejection> {
        let state = ApiState::from_ref(state);

        let conn = state.pool.get_owned().await.no_additional_reason()?;

        let mut db_connection = DatabaseConnection::new(conn).await?;

        if let Some(TypedHeader(Authorization(bearer_auth))) =
            <TypedHeader<Authorization<Bearer>> as OptionalFromRequestParts<ApiState>>::from_request_parts(
                parts, &state,
            )
            .await
            .with_reason("Failed to decode bearer auth header")?
        {
            db_connection.login_user_with_access_token(bearer_auth.token(), &state.decoding_key).await?;
        } else {
            db_connection.login_as_anon().await?;
        }

        return Ok(db_connection);
    }
}
