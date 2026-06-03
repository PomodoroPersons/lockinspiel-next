use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::{CookieJar, cookie::Cookie};
use color_eyre::eyre::{Context, OptionExt, eyre};
use diesel::{
    ExpressionMethods, HasQuery, OptionalExtension, QueryDsl, SelectableHelper,
    declare_sql_function, prelude::Insertable, sql_types,
};
use diesel_async::RunQueryDsl;
use jsonwebtoken::EncodingKey;
use lockinspiel_backend_common::{
    Placeholder,
    auth::{DatabaseConnection, DatabaseUser, InsertableDatabaseUser},
    error::{self, EyreError, WithStatusCode},
    users::{RefreshToken, User, UserClaims},
};
use serde::{Deserialize, Serialize};
use tracing::instrument;
use utoipa::ToSchema;
use uuid::Uuid;

use lockinspiel_auth_schema::schema::auth::{refresh_tokens, users};

use crate::{REFRESH_TOKEN_NAME, create_refresh_token_cookie};

#[declare_sql_function]
extern "SQL" {
    fn generate_uuidv7() -> sql_types::Uuid;
    fn now() -> sql_types::Timestamptz;
}

#[derive(ToSchema, Deserialize, Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Login {
    Credentials {
        username: String,
        password: String,
    },
    RefreshToken {
        /// If the refresh token is null, it's assumed that the token
        /// will be provided via a cookie
        token: Option<String>,
    },
}

impl Placeholder for Login {
    fn placeholder() -> Self {
        Self::Credentials {
            username: "johndoe".to_owned(),
            password: "password".to_owned(),
        }
    }
}

#[derive(ToSchema, Deserialize, Serialize, Debug, Default)]
pub struct LoginToken {
    access_token: String,
}

#[instrument]
pub fn encode_tokens(
    jwt_header: &jsonwebtoken::Header,
    encoding_key: &EncodingKey,
    user: User,
    refresh_token: RefreshToken,
) -> Result<(LoginToken, Cookie<'static>), error::EyreError> {
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

    let mut refresh_token_cookie_buf = Uuid::encode_buffer();
    let mut refresh_token_cookie = create_refresh_token_cookie();
    refresh_token_cookie.set_value(
        refresh_token
            .refresh_token
            .simple()
            .encode_lower(&mut refresh_token_cookie_buf)
            .to_owned(),
    );

    Ok((LoginToken { access_token }, refresh_token_cookie))
}

impl Placeholder for LoginToken {
    #[instrument]
    fn placeholder() -> Self {
        encode_tokens(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &EncodingKey::from_secret(b"example secret"),
            User::placeholder(),
            RefreshToken::placeholder(),
        )
        .expect("Failed to construct LoginToken placeholder")
        .0
    }
}

#[derive(Insertable, ToSchema, Deserialize, Serialize, Debug, PartialEq)]
#[diesel(table_name = refresh_tokens)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct InsertableRefreshToken {
    user_id: uuid::Uuid,
}

#[utoipa::path(
    post,
    path = "/auth/user",
    tag = "User",
    summary = "Create account",
    description = "Creates a new account with a username and passsword",
    request_body(content(
        (InsertableDatabaseUser, example = InsertableDatabaseUser::placeholder),
    )),
    responses(
        (status = OK, description = "Ok",
            content(
                (LoginToken, example = LoginToken::placeholder)
            ),
            headers(
                ("Set-Cookie" = String, description = "An HTTP-Only cookie called `lockinspiel-refresh` will contain the refresh token.")
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
#[instrument(skip(db, encoding_key, jwt_header, cookie_jar))]
pub async fn signup(
    mut db: DatabaseConnection,
    cookie_jar: CookieJar,
    State(encoding_key): State<EncodingKey>,
    State(jwt_header): State<jsonwebtoken::Header>,
    Json(new_user): Json<InsertableDatabaseUser>,
) -> Result<(CookieJar, Json<LoginToken>), error::EyreError> {
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

    let (encoded_access, refresh_token_cookie) =
        encode_tokens(&jwt_header, &encoding_key, user.clone(), refresh_token)?;

    Ok((cookie_jar.add(refresh_token_cookie), Json(encoded_access)))
}

#[utoipa::path(
    delete,
    path = "/auth/user",
    tag = "User",
    summary = "Delete account",
    description = "Deletes the account of the currently authenticated user.",
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
pub async fn delete_user(
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

#[utoipa::path(
    post,
    path = "/auth/session",
    tag = "Session",
    summary = "New session",
    description = "Creates a fresh session either via a username and password, or via a refresh token (which becomes invalidated after this request).",
    request_body(content(
        (Login, example = Login::placeholder),
    )),
    responses(
        (status = OK, description = "Ok",
            content(
                (LoginToken, example = LoginToken::placeholder)
            ),
            headers(
                ("Set-Cookie" = String, description = "An HTTP-Only cookie called `lockinspiel-refresh` will contain the refresh token.")
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
    security(
        ("refresh_cookie" = []),
        ()
    )
)]
#[instrument(skip(db, encoding_key, jwt_header, cookie_jar))]
pub async fn new_session(
    mut db: DatabaseConnection,
    cookie_jar: CookieJar,
    State(encoding_key): State<EncodingKey>,
    State(jwt_header): State<jsonwebtoken::Header>,
    Json(new_user): Json<Login>,
) -> Result<(CookieJar, Json<LoginToken>), error::EyreError> {
    match new_user {
        Login::Credentials { username, password } => {
            let user = DatabaseUser::query()
                .filter(users::username.eq(username))
                .get_result(&mut db.connection)
                .await
                .optional()
                .wrap_err("Failed to get user from database")
                .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?
                .ok_or_eyre("Couldn't find user in database")
                .with_status_code(StatusCode::UNAUTHORIZED)?;

            db.login_user(user, &password).await?;
        }
        Login::RefreshToken { token } => {
            let Some(refresh_token) = token.as_ref().map(|s| s.as_str()).or_else(|| {
                cookie_jar
                    .get(REFRESH_TOKEN_NAME)
                    .map(|c| c.value_trimmed())
            }) else {
                return Err(eyre!("A refresh token was not provided"))
                    .with_status_code(StatusCode::UNAUTHORIZED);
            };

            let refresh_token = Uuid::parse_str(refresh_token)
                .wrap_err("The provided refresh token was not a valid UUID")
                .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

            db.login_user_with_refresh_token(refresh_token).await?;

            diesel::delete(refresh_tokens::table)
                .filter(refresh_tokens::refresh_token.eq(refresh_token))
                .execute(&mut db.connection)
                .await
                .wrap_err("Failed to update refresh token in database")
                .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;
        }
    };

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

    let (encoded_access, refresh_token_cookie) =
        encode_tokens(&jwt_header, &encoding_key, user.clone(), refresh_token)?;

    Ok((cookie_jar.add(refresh_token_cookie), Json(encoded_access)))
}

#[utoipa::path(
    delete,
    path = "/auth/session",
    tag = "Session",
    summary = "Logout",
    description = "Logs out of the currently authenticated user (invalidates the current session)",
    responses(
        (status = OK, description = "Ok",
            content(
                (LoginToken, example = LoginToken::placeholder)
            ),
            headers(
                ("Set-Cookie" = String, description = "An HTTP-Only cookie called `lockinspiel-refresh` will contain the refresh token.")
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
    security(
        (
            "refresh_cookie" = [],
            "bearer_jwt" = []
        ),
    )
)]
#[instrument(skip(connection))]
pub async fn logout(
    cookie_jar: CookieJar,
    DatabaseConnection { mut connection, .. }: DatabaseConnection,
) -> Result<CookieJar, error::EyreError> {
    let Some(refresh_token) = cookie_jar.get(REFRESH_TOKEN_NAME) else {
        return Err(eyre!("A refresh token was not provided"))
            .with_status_code(StatusCode::BAD_REQUEST);
    };

    let refresh_token = Uuid::parse_str(refresh_token.value_trimmed())
        .wrap_err("The provided refresh token was not a valid UUID")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    diesel::delete(refresh_tokens::table)
        .filter(refresh_tokens::refresh_token.eq(refresh_token))
        .execute(&mut connection)
        .await
        .wrap_err("Failed to delete user refresh token from database")
        .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(cookie_jar.remove(create_refresh_token_cookie()))
}
