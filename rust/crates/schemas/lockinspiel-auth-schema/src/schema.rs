// @generated automatically by Diesel CLI.

pub mod auth {
    diesel::table! {
        auth.refresh_tokens (refresh_token, exp) {
            refresh_token -> Uuid,
            user_id -> Uuid,
            exp -> Timestamptz,
        }
    }

    diesel::table! {
        auth.users (user_id) {
            user_id -> Uuid,
            username -> Varchar,
            pbkdf2_iterations -> Int4,
            salt -> Bytea,
            password -> Bytea,
            role -> Varchar,
        }
    }

    diesel::joinable!(refresh_tokens -> users (user_id));

    diesel::allow_tables_to_appear_in_same_query!(refresh_tokens, users,);
}
