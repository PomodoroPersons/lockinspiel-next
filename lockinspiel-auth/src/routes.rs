use axum::{Json, extract::State, http::StatusCode};
use color_eyre::eyre::{Context, OptionExt, eyre};
use diesel::{
    ExpressionMethods, HasQuery, OptionalExtension, QueryDsl, SelectableHelper,
    declare_sql_function, dsl::sql, prelude::Insertable, sql_types,
};
use diesel_async::RunQueryDsl;
use jsonwebtoken::EncodingKey;
use lockinspiel_backend_common::{
    ApiState, Placeholder,
    auth::{DatabaseConnection, DatabaseUser, InsertableDatabaseUser},
    error::{self, EyreError, WithStatusCode},
    schema::{refresh_tokens, users},
    users::{RefreshToken, RefreshTokenClaims, User, UserClaims},
};
use serde::{Deserialize, Serialize};
use tracing::instrument;
use utoipa::ToSchema;

#[declare_sql_function]
extern "SQL" {
    fn uuidv7() -> sql_types::Uuid;
    fn now() -> sql_types::Timestamptz;
}

#[derive(ToSchema, Deserialize, Serialize, Debug, Default)]
pub struct Login {
    username: String,
    password: String,
}

impl Placeholder for Login {
    fn placeholder() -> Self {
        Self {
            username: "johndoe".to_owned(),
            password: "password".to_owned(),
        }
    }
}

#[derive(ToSchema, Deserialize, Serialize, Debug, Default)]
pub struct LoginTokens {
    access_token: String,
    refresh_token: String,
}

impl LoginTokens {
    #[instrument]
    pub fn encode(
        jwt_header: &jsonwebtoken::Header,
        encoding_key: &EncodingKey,
        user: User,
        refresh_token: RefreshToken,
    ) -> Result<Self, error::EyreError> {
        let access_token = jsonwebtoken::encode(
            jwt_header,
            &UserClaims {
                exp: jsonwebtoken::get_current_timestamp() + 3600,
                user,
            },
            encoding_key,
        )
        .wrap_err("Failed to encode access token")
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?;

        let refresh_token = jsonwebtoken::encode(
            jwt_header,
            &RefreshTokenClaims {
                refresh_token: refresh_token.refresh_token,
                user_id: refresh_token.user_id,
            },
            encoding_key,
        )
        .wrap_err("Failed to encode refresh token")
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?;

        Ok(LoginTokens {
            access_token,
            refresh_token,
        })
    }
}

impl Placeholder for LoginTokens {
    fn placeholder() -> Self {
        Self::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &EncodingKey::from_secret(b"example secret"),
            User::placeholder(),
            RefreshToken::placeholder(),
        )
        .expect("Failed to construct LoginToken placeholder")
    }
}

#[derive(ToSchema, Deserialize, Serialize, Debug, Default)]
pub struct RefreshTokenQuery {
    refresh_token: String,
}

impl Placeholder for RefreshTokenQuery {
    fn placeholder() -> Self {
        Self {
            refresh_token: LoginTokens::placeholder().refresh_token,
        }
    }
}

#[derive(Insertable, ToSchema, Deserialize, Serialize, Debug, PartialEq)]
#[diesel(table_name = lockinspiel_backend_common::schema::refresh_tokens)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct InsertableRefreshToken {
    user_id: uuid::Uuid,
}

#[utoipa::path(
    post,
    path = "/auth/signup",
    tag = "Users",
    description = "Create a new account",
    request_body(content(
        (InsertableDatabaseUser, example = InsertableDatabaseUser::placeholder),
    )),
    responses(
        (status = OK, description = "Ok",
            content(
                (LoginTokens, example = LoginTokens::placeholder)
            )
        ),
        (status = "4XX", description = "It's your fault",
            content(
                (inline(EyreError) = "text/html", example = EyreError::render_placeholder),
            )
        ),
        (status = "5XX", description = "We're having a skill issue",
            content(
                (inline(EyreError) = "text/html", example = EyreError::render_placeholder),
            )
        ),
    ),
)]
#[instrument(skip(db, encoding_key, jwt_header))]
pub async fn signup(
    mut db: DatabaseConnection,
    State(encoding_key): State<EncodingKey>,
    State(jwt_header): State<jsonwebtoken::Header>,
    Json(new_user): Json<InsertableDatabaseUser>,
) -> Result<Json<LoginTokens>, error::EyreError> {
    db.signup_user(new_user)
        .await
        .wrap_err("Failed to insert user into database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    let Some(user) = &db.user else {
        return Err(eyre!(
            "Failed to get signed up user from database connection"
        ))
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let refresh_token = diesel::insert_into(refresh_tokens::table)
        .values(InsertableRefreshToken {
            user_id: user.user_id,
        })
        .returning(RefreshToken::as_returning())
        .get_result(&mut db.connection)
        .await
        .wrap_err("Failed to insert refresh token into database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    Ok(Json(LoginTokens::encode(
        &jwt_header,
        &encoding_key,
        user.clone(),
        refresh_token,
    )?))
}

#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "Users",
    description = "Login to your account",
    request_body(content(
        (Login, example = Login::placeholder),
    )),
    responses(
        (status = OK, description = "Ok",
            content(
                (LoginTokens, example = LoginTokens::placeholder)
            )
        ),
        (status = "4XX", description = "It's your fault",
            content(
                (inline(EyreError) = "text/html", example = EyreError::render_placeholder),
            )
        ),
        (status = "5XX", description = "We're having a skill issue",
            content(
                (inline(EyreError) = "text/html", example = EyreError::render_placeholder),
            )
        ),
    ),
)]
#[instrument(skip(db, encoding_key, jwt_header))]
pub async fn login(
    mut db: DatabaseConnection,
    State(encoding_key): State<EncodingKey>,
    State(jwt_header): State<jsonwebtoken::Header>,
    Json(new_user): Json<Login>,
) -> Result<Json<LoginTokens>, error::EyreError> {
    let user = DatabaseUser::query()
        .filter(users::username.eq(new_user.username))
        .get_result(&mut db.connection)
        .await
        .optional()
        .wrap_err("Failed to get user from database")
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or_eyre("Couldn't find user in database")
        .with_status_code(StatusCode::UNAUTHORIZED)?;

    db.login_user(user, &new_user.password).await?;

    let Some(user) = &db.user else {
        return Err(eyre!(
            "Failed to get signed up user from database connection"
        ))
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR);
    };

    let refresh_token = diesel::insert_into(refresh_tokens::table)
        .values(InsertableRefreshToken {
            user_id: user.user_id,
        })
        .returning(RefreshToken::as_returning())
        .get_result(&mut db.connection)
        .await
        .wrap_err("Failed to insert refresh token into database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    Ok(Json(LoginTokens::encode(
        &jwt_header,
        &encoding_key,
        user.clone(),
        refresh_token,
    )?))
}

#[utoipa::path(
    post,
    path = "/auth/refresh",
    tag = "Users",
    description = "Exchanges a refresh token for a new access token",
    request_body(content(
        (RefreshTokenQuery, example = RefreshTokenQuery::placeholder),
    )),
    responses(
        (status = OK, description = "Ok",
            content(
                (LoginTokens, example = LoginTokens::placeholder)
            )
        ),
        (status = "4XX", description = "It's your fault",
            content(
                (inline(EyreError) = "text/html", example = EyreError::render_placeholder),
            )
        ),
        (status = "5XX", description = "We're having a skill issue",
            content(
                (inline(EyreError) = "text/html", example = EyreError::render_placeholder),
            )
        ),
    ),
)]
#[instrument(skip(db, encoding_key, jwt_header, api_state))]
pub async fn refresh(
    mut db: DatabaseConnection,
    State(encoding_key): State<EncodingKey>,
    State(jwt_header): State<jsonwebtoken::Header>,
    State(api_state): State<ApiState>,
    Json(token): Json<RefreshTokenQuery>,
) -> Result<Json<LoginTokens>, error::EyreError> {
    let claims = db
        .login_user_with_refresh_token(token.refresh_token, &api_state.jwk_set)
        .await?;

    let current_refresh_token = RefreshToken::query()
        .filter(refresh_tokens::refresh_token.eq(claims.refresh_token))
        .get_result(&mut db.connection)
        .await
        .optional()
        .wrap_err("Failed to get refresh token from database")
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or_eyre("Couldn't find refresh token in database")
        .with_status_code(StatusCode::UNAUTHORIZED)?;

    if current_refresh_token.exp.0 < jiff::Timestamp::now() {
        diesel::delete(refresh_tokens::table)
            .filter(refresh_tokens::refresh_token.eq(claims.refresh_token))
            .execute(&mut db.connection)
            .await
            .wrap_err("Failed to delete expired refresh token from database")
            .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?;

        return Err(eyre!("Your refresh token is expired, login again"))
            .with_status_code(StatusCode::UNAUTHORIZED);
    }

    let new_refresh_token = diesel::update(refresh_tokens::table)
        .filter(refresh_tokens::refresh_token.eq(claims.refresh_token))
        .set((
            refresh_tokens::refresh_token.eq(uuidv7()),
            refresh_tokens::exp.eq(sql::<sql_types::Timestamptz>("now() + '30 days'")),
        ))
        .returning(RefreshToken::as_returning())
        .get_result(&mut db.connection)
        .await
        .wrap_err("Failed to update refresh token in database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    let user = User::query()
        .filter(users::user_id.eq(current_refresh_token.user_id))
        .get_result(&mut db.connection)
        .await
        .wrap_err("Failed to get user in refresh token from database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    Ok(Json(LoginTokens::encode(
        &jwt_header,
        &encoding_key,
        user,
        new_refresh_token,
    )?))
}

#[utoipa::path(
    delete,
    path = "/auth/login",
    tag = "Users",
    description = "Delete account",
    responses(
        (status = OK, description = "Ok"),
        (status = "4XX", description = "It's your fault",
            content(
                (inline(EyreError) = "text/html", example = EyreError::render_placeholder),
            )
        ),
        (status = "5XX", description = "We're having a skill issue",
            content(
              (inline(EyreError) = "text/html", example = EyreError::render_placeholder),
            )
        ),
    ),
    security(
        ("bearer_jwt" = []),
    )
)]
#[instrument(skip(connection))]
pub async fn delete_login(
    DatabaseConnection {
        mut connection,
        user,
    }: DatabaseConnection,
) -> Result<(), error::EyreError> {
    let Some(user_id) = user.map(|u| u.user_id) else {
        return Err(eyre!("You need to be logged in to delete your account"))
            .with_status_code(StatusCode::UNAUTHORIZED);
    };

    diesel::delete(refresh_tokens::table)
        .filter(refresh_tokens::user_id.eq(user_id))
        .execute(&mut connection)
        .await
        .wrap_err("Failed to delete refresh tokens from database")
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?;
    diesel::delete(users::table)
        .filter(users::user_id.eq(user_id))
        .execute(&mut connection)
        .await
        .wrap_err("Failed to delete user from database")
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(())
}
