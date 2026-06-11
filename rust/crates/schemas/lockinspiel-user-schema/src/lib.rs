#[cfg(feature = "diesel")]
use diesel::{AsChangeset, Insertable};
#[cfg(feature = "diesel")]
use diesel_migrations::{EmbeddedMigrations, embed_migrations};
use serde::{Deserialize, Serialize};
#[cfg(feature = "utoipa")]
use utoipa::ToSchema;
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
#[diesel(table_name = schema::user::profiles)]
#[diesel(check_for_backend(diesel::pg::Pg))]
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
