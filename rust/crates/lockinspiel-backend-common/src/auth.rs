use std::{borrow::Cow, num::NonZeroU32};

use aws_lc_rs::{digest, pbkdf2};
use axum::{
    extract::{FromRef, FromRequestParts, OptionalFromRequestParts},
    http::StatusCode,
};
use axum_extra::{
    TypedHeader,
    headers::{Authorization, authorization::Bearer},
    typed_header::TypedHeaderRejection,
};
use diesel::{
    ExpressionMethods, HasQuery, OptionalExtension, QueryDsl, SelectableHelper,
    declare_sql_function,
    prelude::{AsChangeset, Insertable},
    sql_types,
};
use diesel_async::{
    AsyncPgConnection, RunQueryDsl,
    pooled_connection::bb8::{self, RunError},
};
use jsonwebtoken::Validation;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::instrument;
use utoipa::{
    PartialSchema, ToSchema,
    openapi::{RefOr, Schema},
};
use uuid::Uuid;

use crate::{
    ApiState, Placeholder,
    error::{AsStatusCode, Error, WithReason},
    jwk_set::JwkSetManager,
    sql_types::DieselByteA,
    users::{RefreshToken, User, UserClaims},
};

use lockinspiel_auth_schema::schema::auth::{refresh_tokens, users};

#[declare_sql_function]
extern "SQL" {
    #[sql_name = "auth.uid"]
    fn uid() -> sql_types::Uuid;
    #[sql_name = "auth.set_uid"]
    fn set_uid(uid: sql_types::Uuid) -> sql_types::Text;
}

pub static PBKDF2_ALG: pbkdf2::Algorithm = pbkdf2::PBKDF2_HMAC_SHA256;
pub const PBKDF2_ITERATIONS: NonZeroU32 = NonZeroU32::new(310_000).unwrap();
pub static JWT_ALG: jsonwebtoken::Algorithm = jsonwebtoken::Algorithm::ES256;
pub const CREDENTIAL_LEN: usize = digest::SHA256_OUTPUT_LEN;
pub const SALT_LEN: usize = 16;
pub type Credential = [u8; CREDENTIAL_LEN];
pub type Salt = [u8; SALT_LEN];

#[derive(HasQuery, Debug, PartialEq)]
#[diesel(table_name = users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DatabaseUser {
    pub user_id: Uuid,
    pub username: String,
    pub role: String,
    pub pbkdf2_iterations: i32,
    #[diesel(deserialize_as = DieselByteA<SALT_LEN>)]
    pub salt: Salt,
    #[diesel(deserialize_as = DieselByteA<CREDENTIAL_LEN>)]
    pub password: Credential,
}

impl From<DatabaseUser> for User {
    fn from(value: DatabaseUser) -> Self {
        Self {
            user_id: value.user_id,
            username: value.username,
            role: value.role,
        }
    }
}

#[derive(Insertable, AsChangeset, Debug, PartialEq)]
#[diesel(table_name = users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DatabaseUserPassword {
    #[diesel(skip_insertion, skip_update)]
    password_str: String,
    pbkdf2_iterations: i32,
    salt: DieselByteA<SALT_LEN>,
    password: DieselByteA<CREDENTIAL_LEN>,
}

#[derive(ToSchema, Deserialize, Serialize)]
pub struct DatabaseUserPasswordRaw<'a> {
    password: Cow<'a, str>,
}

impl PartialSchema for DatabaseUserPassword {
    fn schema() -> RefOr<Schema> {
        DatabaseUserPasswordRaw::schema()
    }
}

impl ToSchema for DatabaseUserPassword {
    fn name() -> Cow<'static, str> {
        Cow::Borrowed("DatabaseUserPassword")
    }

    fn schemas(
        schemas: &mut Vec<(
            String,
            utoipa::openapi::RefOr<utoipa::openapi::schema::Schema>,
        )>,
    ) {
        DatabaseUserPasswordRaw::schemas(schemas);
    }
}

impl<'de> Deserialize<'de> for DatabaseUserPassword {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de::Error;

        let password_raw = DatabaseUserPasswordRaw::deserialize(deserializer)?;
        let mut salt: Salt = [0; 16];
        aws_lc_rs::rand::fill(&mut salt).map_err(|e| D::Error::custom(e))?;
        let mut password: Credential = [0; CREDENTIAL_LEN];
        pbkdf2::derive(
            PBKDF2_ALG,
            PBKDF2_ITERATIONS,
            &salt,
            password_raw.password.as_bytes(),
            &mut password,
        );

        Ok(Self {
            password_str: password_raw.password.into_owned(),
            pbkdf2_iterations: PBKDF2_ITERATIONS.get() as i32,
            password: DieselByteA(password),
            salt: DieselByteA(salt),
        })
    }
}

impl Serialize for DatabaseUserPassword {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        DatabaseUserPasswordRaw {
            password: Cow::Borrowed(&self.password_str),
        }
        .serialize(serializer)
    }
}

impl Placeholder for DatabaseUserPassword {
    fn placeholder() -> Self {
        Self {
            password_str: String::from("password"),
            pbkdf2_iterations: PBKDF2_ITERATIONS.get() as i32,
            salt: DieselByteA::placeholder(),
            password: DieselByteA::placeholder(),
        }
    }
}

#[derive(Insertable, AsChangeset, ToSchema, Deserialize, Serialize, Debug, PartialEq)]
#[diesel(table_name = users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct InsertableDatabaseUser {
    username: String,
    #[serde(flatten)]
    #[diesel(embed)]
    password: DatabaseUserPassword,
}

impl Placeholder for InsertableDatabaseUser {
    fn placeholder() -> Self {
        Self {
            username: String::from("johndoe"),
            password: DatabaseUserPassword::placeholder(),
        }
    }
}

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
    pub user: Option<User>,
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

    async fn set_uid(&mut self, user: Option<User>) -> Result<(), Error<ErrorKind>> {
        if let Some(user) = &user {
            diesel::sql_query("SET ROLE authenticated")
                .execute(&mut self.connection)
                .await
                .with_reason("Failed to switch into authenticated role")?;
            diesel::select(set_uid(user.user_id))
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

    pub async fn signup_user(
        &mut self,
        new_user: InsertableDatabaseUser,
    ) -> Result<(), Error<ErrorKind>> {
        let user = diesel::insert_into(users::table)
            .values(new_user)
            .returning(User::as_returning())
            .get_result(&mut self.connection)
            .await
            .with_reason("Failed to insert user into database")?;

        self.set_uid(Some(user)).await
    }

    pub async fn login_user(
        &mut self,
        user: DatabaseUser,
        password: &str,
    ) -> Result<(), Error<ErrorKind>> {
        let iterations = NonZeroU32::new(user.pbkdf2_iterations as u32)
            .ok_or(ErrorKind::InvalidPbkdf2Iterations)
            .no_additional_reason()?;

        if pbkdf2::verify(
            PBKDF2_ALG,
            iterations,
            &user.salt,
            password.as_bytes(),
            &user.password,
        )
        .is_ok()
        {
            let user: User = user.into();
            self.set_uid(Some(user)).await?;

            Ok(())
        } else {
            Err(ErrorKind::Unauthorized).no_additional_reason()
        }
    }

    pub async fn login_user_with_access_token(
        &mut self,
        token: impl AsRef<[u8]>,
        jwk_set: &JwkSetManager,
    ) -> Result<(), Error<ErrorKind>> {
        let token: UserClaims = jwk_set.decode(token, &Validation::new(JWT_ALG)).await?;

        self.set_uid(Some(token.user)).await?;

        Ok(())
    }

    pub async fn login_user_with_refresh_token(
        &mut self,
        token: Uuid,
    ) -> Result<(), Error<ErrorKind>> {
        let current_refresh_token = RefreshToken::query()
            .filter(refresh_tokens::refresh_token.eq(token))
            .get_result(&mut self.connection)
            .await
            .optional()
            .with_reason("Failed to get refresh token from database")?
            .ok_or(ErrorKind::Unauthorized)
            .with_reason("Couldn't find refresh token in database")?;

        if current_refresh_token.exp.0 < jiff::Timestamp::now() {
            diesel::delete(refresh_tokens::table)
                .filter(refresh_tokens::refresh_token.eq(token))
                .execute(&mut self.connection)
                .await
                .with_reason("Failed to delete expired refresh token from database")?;

            return Err(ErrorKind::Unauthorized)
                .with_reason("Your refresh token is expired, login again");
        }

        let user = User::query()
            .filter(users::user_id.eq(current_refresh_token.user_id))
            .get_result(&mut self.connection)
            .await
            .with_reason("Failed to get user in refresh token from database")?;

        self.set_uid(Some(user)).await?;

        Ok(())
    }

    pub async fn login_as_anon(&mut self) -> Result<(), Error<ErrorKind>> {
        self.set_uid(None).await
    }

    pub fn user(&self) -> Option<&User> {
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
    #[error("User has invalid PBKDF2 iterations value")]
    InvalidPbkdf2Iterations,
    #[error("The database encountered an error")]
    DieselError(#[from] diesel::result::Error),
    #[error("An error occurred while processing a JWT")]
    JWTError(#[from] jsonwebtoken::errors::Error),
    #[error("A reqwest error occurred")]
    ReqwestError(#[from] reqwest::Error),
    #[error("An error occurred while pulling the KID out of a JWT")]
    KIDError,
    #[error("Invalid username or password")]
    Unauthorized,
    #[error("The URL was unable to be parsed")]
    UrlParseError,
}

impl AsStatusCode for ErrorKind {
    fn status_code(&self) -> StatusCode {
        match self {
            ErrorKind::DbConnectionError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorKind::IOError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorKind::ParseHeader(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorKind::InvalidPbkdf2Iterations => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorKind::DieselError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::JWTError(_) => StatusCode::UNAUTHORIZED,
            Self::ReqwestError(r) => r.status().unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            Self::KIDError => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::UrlParseError => StatusCode::BAD_REQUEST,
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

        // let mut user = None;

        // if let Some(TypedHeader(Authorization(basic_auth))) =
        //     <TypedHeader<Authorization<Basic>> as OptionalFromRequestParts<ApiState>>::from_request_parts(
        //         parts, &state,
        //     )
        //     .await
        //     .with_reason("Failed to decode basic auth header")?
        // {
        //     let db_user = DatabaseUser::query()
        //         .filter(users::username.eq(basic_auth.username()))
        //         .first(&mut conn)
        //         .await
        //         .optional()
        //         .with_reason("Failed to get user from database")?
        //         .ok_or(ErrorKind::Unauthorized)
        //         .with_reason("Couldn't find that user")?;

        //     let iterations = NonZeroU32::new(db_user.pbkdf2_iterations as u32)
        //         .ok_or(ErrorKind::InvalidPbkdf2Iterations)
        //         .no_additional_reason()?;

        //     if pbkdf2::verify(
        //         PBKDF2_ALG,
        //         iterations,
        //         &db_user.salt,
        //         basic_auth.password().as_bytes(),
        //         &db_user.password,
        //     )
        //     .is_err()
        //     {
        //         return Err(ErrorKind::Unauthorized).with_reason("Invalid password")?;
        //     }

        //     user = Some(User {
        //         user_id: db_user.user_id,
        //         username: db_user.username,
        //     });
        // }

        let mut db_connection = DatabaseConnection::new(conn).await?;

        if let Some(TypedHeader(Authorization(bearer_auth))) =
            <TypedHeader<Authorization<Bearer>> as OptionalFromRequestParts<ApiState>>::from_request_parts(
                parts, &state,
            )
            .await
            .with_reason("Failed to decode bearer auth header")?
        {
            db_connection.login_user_with_access_token(bearer_auth.token(), &state.jwk_set).await?;
        } else {
            db_connection.login_as_anon().await?;
        }

        return Ok(db_connection);
    }
}
