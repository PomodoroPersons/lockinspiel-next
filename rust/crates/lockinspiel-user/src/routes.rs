use std::sync::Arc;

use axum::{Json, extract::State, http::StatusCode};
use color_eyre::eyre::{Context, OptionExt, eyre};
use diesel::{
    ExpressionMethods, HasQuery, OptionalExtension, QueryDsl, prelude::Insertable, query_builder::AsChangeset 
};
use diesel_async::RunQueryDsl;
use lockinspiel_backend_common::{
    Placeholder,
    auth::DatabaseConnection,
    error::{self, EyreError, WithStatusCode}, sql_types,
};
use serde::{Deserialize, Serialize};
use tracing::instrument;
use utoipa::ToSchema;

use lockinspiel_user_schema::schema::user::profiles;
use uuid::Uuid;

use crate::url_resolver::{UrlLocation, UrlOrigin, UrlResolver};

#[derive(HasQuery, Deserialize, Serialize)]
#[diesel(table_name = profiles)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DbUserProfile {
    user_id: Uuid,
    display_name: String,
    bio: String,
    avatar_location: Option<sql_types::Json<UrlLocation<'static>>>
}

#[derive(Deserialize, Serialize, ToSchema, Debug)]
pub struct UserProfile {
    user_id: Uuid,
    display_name: String,
    bio: String,
    avatar_location: Option<String>
}

impl Placeholder for UserProfile {
    fn placeholder() -> Self {
        Self {
            user_id: Uuid::nil(),
            display_name: "John Doe".to_owned(),
            bio: "I wonder how Alice and Bob are doing".to_owned(),
            avatar_location: Some(String::from("/user/profile"))
        }
    }
}

impl DbUserProfile {
    async fn into_user_profile(self, resolver: &UrlResolver) -> UserProfile{
        let mut avatar_location = None;
        if let Some(location) = self.avatar_location {
            avatar_location = Some(resolver.resolve_get_url(location.0).await);
        }
        UserProfile{
            user_id: self.user_id,
            display_name: self.display_name,
            bio: self.bio,
            avatar_location
        }
    }
}


#[derive(Insertable, ToSchema, Deserialize, Serialize, Debug, PartialEq)]
#[diesel(table_name = profiles)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct InsertableUserProfile {
    #[serde(skip)]
    user_id: Uuid,
    display_name: String,
    bio: String,
}

impl Placeholder for InsertableUserProfile {
    fn placeholder() -> Self {
        Self {
            user_id: Uuid::nil(),
            display_name: "John Doe".to_owned(),
            bio: "I wonder how Alice and Bob are doing".to_owned(),
        }
    }
}

#[derive(AsChangeset, ToSchema, Deserialize, Serialize, Debug, PartialEq)]
#[diesel(table_name = profiles)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct UserProfileChangeset {
    display_name: String,
    bio: String,
}

impl Placeholder for UserProfileChangeset {
    fn placeholder() -> Self {
        Self {
            display_name: "John Doe".to_owned(),
            bio: "I wonder how Alice and Bob are doing".to_owned(),
        }
    }
}

#[instrument(skip_all)]
async fn get_user_profile(db: &mut DatabaseConnection, user_id: Uuid) -> Result<DbUserProfile, EyreError> {  
    let profile = DbUserProfile::query()
        .filter(profiles::user_id.eq(user_id))
        .get_result(&mut db.connection)
        .await
        .optional()
        .wrap_err("Failed to insert user profile into database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?
        .ok_or_eyre("Failed to find user profile in database")
        .with_status_code(StatusCode::NOT_FOUND)?;

    Ok(profile)
}

#[utoipa::path(
    post,
    path = "/user/profile",
    tag = "Profile",
    summary = "Create profile",
    description = "Creates a new user profile for the current session",
    request_body(content(
        (InsertableUserProfile, example = InsertableUserProfile::placeholder),
    )),
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
#[instrument(skip(db))]
pub async fn create_profile(
    mut db: DatabaseConnection,
    Json(mut new_profile): Json<InsertableUserProfile>,
) -> Result<(), error::EyreError> {
    let Some(user_id) = db.user.map(|u| u.sub) else {
        return Err(eyre!("You need to be logged in to create a user profile"))
            .with_status_code(StatusCode::UNAUTHORIZED);
    };

    new_profile.user_id = user_id;

    diesel::insert_into(profiles::table)
        .values(new_profile)
        .execute(&mut db.connection)
        .await
        .wrap_err("Failed to insert user profile into database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    Ok(())
}

#[utoipa::path(
    get,
    path = "/user/profile",
    tag = "Profile",
    summary = "Get profile",
    description = "Gets the user profile for the current session",
    responses(
        (status = OK, description = "Ok",
            content(
                (UserProfile, example = UserProfile::placeholder)                
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
        ("bearer_jwt" = []),
    )
)]
#[instrument(skip(db))]
pub async fn get_profile(
    State(url_resolver): State<Arc<UrlResolver>>,
    mut db: DatabaseConnection,
) -> Result<Json<UserProfile>, error::EyreError> {
    let Some(user_id) = db.user.as_ref().map(|u| u.sub) else {
        return Err(eyre!("You need to be logged in to get your user profile"))
            .with_status_code(StatusCode::UNAUTHORIZED);
    };

    Ok(Json(get_user_profile(&mut db, user_id).await?.into_user_profile(&url_resolver).await))
}

#[derive(Deserialize, Serialize, ToSchema, Debug)]
pub struct PutAvatarQuery {
    file_extension: String
}

impl Placeholder for PutAvatarQuery {
    fn placeholder() -> Self {
        Self {
            file_extension: String::from("png")
        }
    }
}

#[utoipa::path(
    put,
    path = "/user/profile/avatar",
    tag = "Profile",
    summary = "Replace profile avatar",
    description = "Returns the URL that should be used to upload an image of the user's new avatar",
    request_body(content(
        (PutAvatarQuery, example = PutAvatarQuery::placeholder),
    )),
    responses(
        (status = OK, description = "Ok",
            content(
                (String, example = "/user/profile/avatar/upload")                
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
        ("bearer_jwt" = []),
    )
)]
#[instrument(skip(db))]
pub async fn put_avatar(
    State(url_resolver): State<Arc<UrlResolver>>,
    mut db: DatabaseConnection,
    Json(put_avatar_query): Json<PutAvatarQuery>,
) -> Result<String, error::EyreError> {
    let Some(user_id) = db.user.as_ref().map(|u| u.sub) else {
        return Err(eyre!("You need to be logged in to create a user profile"))
            .with_status_code(StatusCode::UNAUTHORIZED);
    };

    let current_profile = get_user_profile(&mut db, user_id).await?;

    if let Some(location) = current_profile.avatar_location {
        url_resolver.delete_url(location.0).await?;
    }

    let avatar_path = format!("avatars/{}.{}", user_id, put_avatar_query.file_extension);
    // TODO: Don't depend on S3 support
    let url_location = UrlLocation { location: UrlOrigin::S3, path: avatar_path.into() };

    diesel::update(profiles::table)
        .filter(profiles::user_id.eq(user_id))
        .set(profiles::avatar_location.eq(sql_types::Json(&url_location)))
        .execute(&mut db.connection)
        .await
        .wrap_err("Failed to insert user profile into database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    Ok(url_resolver.resolve_put_url(url_location, format!("image/{}", put_avatar_query.file_extension)).await)
}

#[utoipa::path(
    delete,
    path = "/user/profile/avatar",
    tag = "Profile",
    summary = "Delete profile avatar",
    description = "Delete's the user profile's avatar from wherever it is stored",
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
#[instrument(skip(db))]
pub async fn delete_avatar(
    State(url_resolver): State<Arc<UrlResolver>>,
    mut db: DatabaseConnection,
) -> Result<(), error::EyreError> {
    let Some(user_id) = db.user.as_ref().map(|u| u.sub) else {
        return Err(eyre!("You need to be logged in to create a user profile"))
            .with_status_code(StatusCode::UNAUTHORIZED);
    };

    let current_profile = get_user_profile(&mut db, user_id).await?;

    if let Some(location) = current_profile.avatar_location {
        url_resolver.delete_url(location.0).await?;
    }

    diesel::update(profiles::table)
        .filter(profiles::user_id.eq(user_id))
        .set(profiles::avatar_location.eq(None::<sql_types::Json<UrlLocation>>))
        .execute(&mut db.connection)
        .await
        .wrap_err("Failed to insert user profile into database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    Ok(())
}

#[utoipa::path(
    put,
    path = "/user/profile",
    tag = "Profile",
    summary = "Update profile",
    description = "Updates the user profile for the current session",
    request_body(content(
        (UserProfileChangeset, example = UserProfileChangeset::placeholder),
    )),
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
#[instrument(skip(db))]
pub async fn update_profile(
    mut db: DatabaseConnection,
    Json(updated_profile): Json<UserProfileChangeset>,
) -> Result<(), error::EyreError> {
    let Some(user_id) = db.user.map(|u| u.sub) else {
        return Err(eyre!("You need to be logged in to create a user profile"))
            .with_status_code(StatusCode::UNAUTHORIZED);
    };

    diesel::update(profiles::table)
        .filter(profiles::user_id.eq(user_id))
        .set(updated_profile)
        .execute(&mut db.connection)
        .await
        .wrap_err("Failed to insert user profile into database")
        .with_status_code(StatusCode::UNPROCESSABLE_ENTITY)?;

    Ok(())
}

