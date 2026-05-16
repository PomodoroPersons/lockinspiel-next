// @generated automatically by Diesel CLI.

pub mod user {
    diesel::table! {
        user.social_links (user_id, social) {
            user_id -> Uuid,
            social -> Int4,
            link -> Varchar,
        }
    }

    diesel::table! {
        user.socials (id) {
            id -> Int4,
            icon_location -> Nullable<Jsonb>,
            name -> Nullable<Varchar>,
        }
    }

    diesel::table! {
        user.users (user_id) {
            user_id -> Uuid,
            display_name -> Varchar,
            bio -> Nullable<Varchar>,
            avatar_location -> Nullable<Jsonb>,
            status -> Nullable<Varchar>,
        }
    }

    diesel::joinable!(social_links -> socials (social));

    diesel::allow_tables_to_appear_in_same_query!(social_links, socials, users,);
}
