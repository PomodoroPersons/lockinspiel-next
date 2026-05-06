// @generated automatically by Diesel CLI.

diesel::table! {
    refresh_tokens (refresh_token, exp) {
        refresh_token -> Uuid,
        user_id -> Uuid,
        exp -> Timestamptz,
    }
}

diesel::table! {
    tag (id) {
        id -> Int4,
        name -> Varchar,
        user_id -> Nullable<Uuid>,
        deleted -> Bool,
    }
}

diesel::table! {
    time_split (id) {
        id -> Int4,
        name -> Varchar,
        description -> Nullable<Varchar>,
        deleted -> Bool,
    }
}

diesel::table! {
    time_split_timer (id) {
        id -> Int4,
        time_split_id -> Int4,
        len -> Interval,
        name -> Varchar,
        work -> Bool,
    }
}

diesel::table! {
    timesheet (start_time) {
        timesheet_group -> Uuid,
        start_time -> Timestamptz,
        end_time -> Timestamptz,
        user_id -> Uuid,
        work -> Bool,
    }
}

diesel::table! {
    timesheet_group (id) {
        id -> Uuid,
        time_split_id -> Int4,
        user_id -> Uuid,
    }
}

diesel::table! {
    timesheet_tag (timesheet_group, tag_id) {
        timesheet_group -> Uuid,
        tag_id -> Int4,
        user_id -> Uuid,
    }
}

diesel::table! {
    users (user_id) {
        user_id -> Uuid,
        username -> Varchar,
        pbkdf2_iterations -> Int4,
        salt -> Bytea,
        password -> Bytea,
        role -> Varchar,
    }
}

diesel::joinable!(refresh_tokens -> users (user_id));
diesel::joinable!(tag -> users (user_id));
diesel::joinable!(time_split_timer -> time_split (time_split_id));
diesel::joinable!(timesheet -> users (user_id));
diesel::joinable!(timesheet_group -> time_split (time_split_id));
diesel::joinable!(timesheet_group -> users (user_id));
diesel::joinable!(timesheet_tag -> tag (tag_id));
diesel::joinable!(timesheet_tag -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    refresh_tokens,
    tag,
    time_split,
    time_split_timer,
    timesheet,
    timesheet_group,
    timesheet_tag,
    users,
);
