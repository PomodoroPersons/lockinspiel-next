use diesel::HasQuery;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{Placeholder, sql_types::Timestamp};

#[derive(HasQuery, Deserialize, Serialize, Debug, Default, Clone)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub user_id: Uuid,
    pub username: String,
    pub role: String,
}

impl Placeholder for User {
    fn placeholder() -> Self {
        Self {
            user_id: Uuid::nil(),
            username: "johndoe".to_owned(),
            role: String::from("user"),
        }
    }
}

#[derive(HasQuery, Deserialize, Serialize, Debug, Default, Clone)]
#[diesel(table_name = crate::schema::refresh_tokens)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct RefreshToken {
    pub refresh_token: Uuid,
    pub user_id: Uuid,
    pub exp: Timestamp,
}

impl Placeholder for RefreshToken {
    fn placeholder() -> Self {
        Self {
            refresh_token: Uuid::nil(),
            user_id: Uuid::nil(),
            exp: Timestamp(jiff::Timestamp::now()),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct UserClaims {
    pub exp: u64,
    #[serde(flatten)]
    pub user: User,
}

#[derive(Serialize, Deserialize)]
pub struct RefreshTokenClaims {
    pub refresh_token: Uuid,
    pub user_id: Uuid,
}
