use serde::Deserialize;
use utoipa::{IntoResponses, ToSchema};
use utoipa_e2e::IntoPath;

#[derive(Deserialize, ToSchema)]
struct InsertableUserProfile;

struct ProfileApi {
    create_profile: CreateProfileRoute,
}

#[derive(IntoPath)]
#[api_path(
    post,
    path = "/user/profile",
    tag = "Profile",
    summary = "Create profile",
    description = "Creates a new user profile for the current session",
    responses(CreateProfileResponses),
    security(
        ("bearer_jwt" = []),
    )
)]
struct CreateProfileRoute {
    #[body]
    user_profile: InsertableUserProfile,
}

#[derive(IntoResponses, ToSchema)]
enum CreateProfileResponses {
    #[response(status = 200, description = "OK")]
    Success,
    #[response(status = "4XX", description = "It's your fault")]
    YourFailure,
    #[response(status = "5XX", description = "We're having a skill issue")]
    OurFailure,
}

#[utoipa_e2e::implementor_of(CreateProfileRoute)]
fn main() {
    // client.profile.get_profile();
}
