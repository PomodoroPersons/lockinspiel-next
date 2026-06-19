use std::borrow::Cow;

use crate::TimekeeperVoidResponses;
#[cfg(feature = "diesel")]
use crate::schema::timekeeper;
#[cfg(feature = "diesel")]
use diesel::{AsChangeset, ExpressionMethods, HasQuery, Insertable, QueryDsl};
use lockinspiel_common_schema::error::EyreErrorWrapper;
use serde::{Deserialize, Serialize};
#[cfg(feature = "utoipa")]
use utoipa::{IntoResponses, ToSchema};
use utoipa_e2e::IntoPath;

#[cfg_attr(feature = "diesel", derive(AsChangeset, Insertable))]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[cfg_attr(feature = "utoipa", schema(examples(InsertableTag::placeholder)))]
#[derive(Deserialize, Serialize, Debug, PartialEq)]
#[cfg_attr(feature = "diesel", diesel(check_for_backend(diesel::pg::Pg)))]
#[cfg_attr(feature = "diesel", diesel(table_name = timekeeper::tag))]
pub struct InsertableTag<'a> {
    name: Cow<'a, str>,
}

impl InsertableTag<'_> {
    pub fn placeholder() -> Self {
        Self {
            name: Cow::Borrowed("Schoolwork"),
        }
    }
}

#[cfg_attr(feature = "diesel", derive(HasQuery))]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[cfg_attr(feature = "utoipa", schema(examples(Tag::placeholder)))]
#[derive(Deserialize, Serialize, Debug, PartialEq)]
#[cfg_attr(feature = "diesel", diesel(check_for_backend(diesel::pg::Pg)))]
#[cfg_attr(feature = "diesel", diesel(table_name = timekeeper::tag))]
#[cfg_attr(feature = "diesel", diesel(base_query = timekeeper::tag::table.filter(timekeeper::tag::deleted.eq(false))))]
pub struct Tag<'a> {
    id: i32,
    name: Cow<'a, str>,
}

impl Tag<'_> {
    pub fn placeholder() -> Self {
        Self {
            id: 78,
            name: Cow::Borrowed("Schoolwork"),
        }
    }
}

#[cfg_attr(feature = "diesel", derive(HasQuery))]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[cfg_attr(feature = "utoipa", schema(examples(TagID::placeholder)))]
#[derive(Deserialize, Serialize, Debug, PartialEq)]
#[cfg_attr(feature = "diesel", diesel(check_for_backend(diesel::pg::Pg)))]
#[cfg_attr(feature = "diesel", diesel(table_name = timekeeper::tag))]
#[cfg_attr(feature = "diesel", diesel(base_query = timekeeper::tag::table.filter(timekeeper::tag::deleted.eq(false))))]
pub struct TagID {
    id: i32,
}

impl TagID {
    pub fn placeholder() -> Self {
        Self { id: 78 }
    }
}

#[cfg_attr(feature = "utoipa", derive(IntoResponses, ToSchema))]
pub enum TagArrayResponses<'a> {
    #[cfg_attr(feature = "utoipa", response(status = 200))]
    Success(Vec<Tag<'a>>),
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

#[cfg_attr(feature = "utoipa", derive(IntoResponses, ToSchema))]
pub enum TagIDResponses<'a> {
    #[cfg_attr(feature = "utoipa", response(status = 200))]
    Success(TagID),
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

#[derive(IntoPath)]
#[api_path(
    post,
    path = "/timekeeper/tag",
    summary = "Create a tag",
    description = "Creates a new tag in the database. The returned tag ID can be used in other endpoints in this service.",
    tag = "Tag",
    responses(TagIDResponses),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct CreateTagRoute<'a> {
    #[body]
    pub body: InsertableTag<'a>,
}

#[derive(IntoPath)]
#[api_path(
    get,
    path = "/timekeeper/tag",
    summary = "Retreive tags",
    description = "Retreives all the tags associated with the user, as well as the default ones",
    tag = "Tag",
    responses(TagArrayResponses),
    security(
        ("bearer_jwt" = []),
        ()
    )
)]
pub struct GetTagsRoute {}

#[derive(IntoPath)]
#[api_path(
    put,
    path = "/timekeeper/tag/{id}",
    summary = "Modify tag",
    description = "Modifies the fields of the tag at the ID",
    tag = "Tag",
    responses(TimekeeperVoidResponses),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct ModifyTagRoute<'a> {
    #[body]
    pub body: InsertableTag<'a>,
    #[param(Path)]
    pub id: i32,
}

#[derive(IntoPath)]
#[api_path(
    delete,
    path = "/timekeeper/tag/{id}",
    summary = "Delete a tag",
    description = "Deletes the tag at the given ID. This just marks the tag as deleted, and doesn't actually delete the tag in the database. Timers posted with a deleted tag will still have that tag, the tag just won't appear when querying some endpoints.",
    tag = "Tag",
    responses(TimekeeperVoidResponses),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct DeleteTagRoute {
    #[param(Path)]
    pub id: i32,
}
