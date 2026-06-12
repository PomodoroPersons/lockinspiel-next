#[cfg(feature = "diesel")]
use diesel::{AsChangeset, Insertable};
#[cfg(feature = "diesel")]
use diesel_migrations::{EmbeddedMigrations, embed_migrations};
use lockinspiel_common_schema::error::EyreErrorWrapper;
use serde::{Deserialize, Serialize};
use utoipa::IntoResponses;
#[cfg(feature = "utoipa")]
use utoipa::ToSchema;
use utoipa_e2e::IntoPath;
use uuid::Uuid;

#[cfg(feature = "diesel")]
pub mod schema;

#[cfg(feature = "diesel")]
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

#[cfg_attr(feature = "diesel", derive(Insertable))]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[cfg_attr(
    feature = "utoipa",
    schema(examples(InsertableUserProfile::placeholder))
)]
#[derive(Deserialize, Serialize, Debug, PartialEq)]
#[cfg_attr(feature = "diesel", diesel(table_name = schema::user::profiles))]
#[cfg_attr(feature = "diesel", diesel(check_for_backend(diesel::pg::Pg)))]
pub struct InsertableUserProfile {
    #[serde(skip)]
    pub user_id: Uuid,
    pub display_name: String,
    pub bio: String,
}

impl InsertableUserProfile {
    pub fn placeholder() -> Self {
        Self {
            user_id: Uuid::nil(),
            display_name: "John Doe".to_owned(),
            bio: "I wonder how Alice and Bob are doing".to_owned(),
        }
    }
}

#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[derive(Deserialize, Serialize, Debug)]
#[cfg_attr(feature = "utoipa", schema(examples(UserProfile::placeholder)))]
pub struct UserProfile {
    pub user_id: Uuid,
    pub display_name: String,
    pub bio: String,
    pub avatar_location: Option<String>,
}

impl UserProfile {
    pub fn placeholder() -> Self {
        Self {
            user_id: Uuid::nil(),
            display_name: "John Doe".to_owned(),
            bio: "I wonder how Alice and Bob are doing".to_owned(),
            avatar_location: Some(String::from("/user/profile")),
        }
    }
}

#[cfg_attr(feature = "diesel", derive(AsChangeset))]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[cfg_attr(
    feature = "utoipa",
    schema(examples(UserProfileChangeset::placeholder))
)]
#[derive(Deserialize, Serialize, Debug, PartialEq)]
#[cfg_attr(feature = "diesel", diesel(table_name = schema::user::profiles))]
#[cfg_attr(feature = "diesel", diesel(check_for_backend(diesel::pg::Pg)))]
pub struct UserProfileChangeset {
    pub display_name: String,
    pub bio: String,
}

impl UserProfileChangeset {
    pub fn placeholder() -> Self {
        Self {
            display_name: "John Doe".to_owned(),
            bio: "I wonder how Alice and Bob are doing".to_owned(),
        }
    }
}

#[derive(Deserialize, Serialize, ToSchema, Debug)]
#[cfg_attr(
    feature = "utoipa",
    schema(examples(PutAvatarQuery::placeholder))
)]
pub struct PutAvatarQuery {
    pub file_extension: String,
}

impl PutAvatarQuery {
    pub fn placeholder() -> Self {
        Self {
            file_extension: String::from("png"),
        }
    }
}


#[derive(IntoResponses, ToSchema)]
pub enum UserSchemaResponsesVoid<'a> {
    #[response(status = 200)]
    Success(()),
    #[response(
        status = "4XX",
        description = "It's your fault"
    )]
    YourFault(EyreErrorWrapper<'a>),
    #[response(
        status = "5XX",
        description = "We're having a skill issue"
    )]
    OurFault(EyreErrorWrapper<'a>),
}

#[derive(IntoResponses, ToSchema)]
pub enum UserSchemaResponsesString<'a> {
    #[response(status = 200)]
    Success(String),
    #[response(
        status = "4XX",
        description = "It's your fault"
    )]
    YourFault(EyreErrorWrapper<'a>),
    #[response(
        status = "5XX",
        description = "We're having a skill issue"
    )]
    OurFault(EyreErrorWrapper<'a>),
}

#[derive(IntoResponses, ToSchema)]
pub enum UserSchemaUserProfileResponse<'a> {
    #[response(status = 200)]
    Success(UserProfile),
    #[response(
        status = "4XX",
        description = "It's your fault"
    )]
    YourFault(EyreErrorWrapper<'a>),
    #[response(
        status = "5XX",
        description = "We're having a skill issue"
    )]
    OurFault(EyreErrorWrapper<'a>),
}

#[derive(IntoPath)]
#[api_path(
    post,
    path = "/user/profile",
    tag = "Profile",
    summary = "Create profile",
    description = "Creates a new user profile for the current session",
    responses(UserSchemaResponsesVoid),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct CreateProfileRoute {
    #[body]
    pub user_profile: InsertableUserProfile,
}

#[derive(IntoPath)]
#[api_path(
    get,
    path = "/user/profile",
    tag = "Profile",
    summary = "Get profile",
    description = "Gets the user profile for the current session",
    responses(UserSchemaUserProfileResponse),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct GetProfileRoute {}

#[derive(IntoPath)]
#[api_path(
    put,
    path = "/user/profile",
    tag = "Profile",
    summary = "Update profile",
    description = "Updates the user profile for the current session",
    responses(UserSchemaResponsesVoid),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct UpdateProfileRoute {
    #[body]
    pub changeset: UserProfileChangeset
}

#[derive(IntoPath)]
#[api_path(   
    put,
    path = "/user/profile/avatar",
    tag = "Profile",
    summary = "Replace profile avatar",
    description = "Returns the URL that should be used to upload an image of the user's new avatar",
    responses(UserSchemaResponsesString),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct PutAvatarRoute {
    #[body]
    pub avatar_query: PutAvatarQuery,
}

#[derive(IntoPath)]
#[api_path(   
    delete,
    path = "/user/profile/avatar",
    tag = "Profile",
    summary = "Delete profile avatar",
    description = "Delete's the user profile's avatar from wherever it is stored",
    responses(UserSchemaResponsesVoid),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct DeleteAvatarRoute {}
