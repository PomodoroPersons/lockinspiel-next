#[cfg(feature = "diesel")]
use diesel_migrations::{EmbeddedMigrations, embed_migrations};
use lockinspiel_common_schema::error::EyreErrorWrapper;
#[cfg(feature = "utoipa")]
use utoipa::{IntoResponses, ToSchema};

#[cfg(feature = "diesel")]
pub mod schema;

pub mod tag;
pub mod time_split;
pub mod timer;

#[cfg(feature = "diesel")]
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

#[cfg_attr(feature = "utoipa", derive(IntoResponses, ToSchema))]
pub enum TimekeeperVoidResponses<'a> {
    #[cfg_attr(feature = "utoipa", response(status = 200))]
    Success(()),
    #[cfg_attr(
        feature = "utoipa",
        response(status = "4XX", description = "It's your fault")
    )]
    YourFault(EyreErrorWrapper<'a>),
    #[cfg_attr(
        feature = "utoipa",
        response(status = "5XX", description = "We're having a skill issue")
    )]
    OurFault(EyreErrorWrapper<'a>),
}
