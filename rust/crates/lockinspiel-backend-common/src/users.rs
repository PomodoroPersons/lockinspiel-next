use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::Placeholder;

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Identity {
    Default { email: String },
}

impl Default for Identity {
    fn default() -> Self {
        Self::Default {
            email: String::default(),
        }
    }
}

impl Placeholder for Identity {
    fn placeholder() -> Self {
        Self::Default {
            email: "johndoe@example.com".to_owned(),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct UserClaims {
    pub identity: Identity,
    pub sid: Uuid,
    pub sub: Uuid,
}
