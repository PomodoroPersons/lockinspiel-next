#[cfg(feature = "diesel")]
use crate::schema::timekeeper;
#[cfg(feature = "diesel")]
use diesel::{AsChangeset, ExpressionMethods, HasQuery, Insertable, QueryDsl};
use jiff::{SignedDuration, Timestamp};
use lockinspiel_common_schema::{error::EyreErrorWrapper, sql_types::Timestamptz};
use serde::{Deserialize, Serialize};
#[cfg(feature = "utoipa")]
use utoipa::{IntoResponses, ToSchema};
use utoipa_e2e::IntoPath;

#[cfg_attr(feature = "diesel", derive(AsChangeset, Insertable))]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[cfg_attr(feature = "utoipa", schema(examples(InsertableTimer::placeholder)))]
#[derive(Clone, Deserialize, Serialize, Debug, PartialEq)]
#[cfg_attr(feature = "diesel", diesel(table_name = timekeeper::timesheet))]
#[cfg_attr(feature = "diesel", diesel(check_for_backend(diesel::pg::Pg)))]
pub struct InsertableTimer {
    pub time_split_timer: i32,
    pub start_time: Timestamptz,
    pub end_time: Timestamptz,
    pub tags: Vec<i32>,
}

impl InsertableTimer {
    pub fn placeholder() -> Self {
        Self {
            time_split_timer: 36,
            start_time: Timestamptz(Timestamp::now()),
            end_time: Timestamptz(Timestamp::now() + SignedDuration::from_hours(1)),
            tags: vec![54, 45, 78, 23],
        }
    }
}

#[cfg_attr(feature = "diesel", derive(HasQuery))]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[cfg_attr(feature = "utoipa", schema(examples(TimeSplitData::placeholder)))]
#[derive(Deserialize, Serialize, Debug, PartialEq)]
#[cfg_attr(feature = "diesel", diesel(table_name = timekeeper::time_split_timer))]
#[cfg_attr(feature = "diesel", diesel(check_for_backend(diesel::pg::Pg)))]
#[cfg_attr(feature = "diesel", diesel(base_query = timekeeper::time_split_timer::table.filter(timekeeper::time_split_timer::deleted.eq(false))))]
pub struct TimeSplitData {
    pub time_split_id: i32,
    pub work: bool,
}

impl TimeSplitData {
    pub fn placeholder() -> Self {
        Self {
            time_split_id: 43,
            work: true,
        }
    }
}

#[cfg_attr(feature = "diesel", derive(HasQuery))]
#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[cfg_attr(feature = "utoipa", schema(examples(Timer::placeholder)))]
#[derive(Deserialize, Serialize, Debug, PartialEq)]
#[cfg_attr(feature = "diesel", diesel(check_for_backend(diesel::pg::Pg)))]
#[cfg_attr(feature = "diesel", diesel(table_name = timekeeper::timesheet))]
#[cfg_attr(feature = "diesel", diesel(base_query = timekeeper::timesheet::table.inner_join(timekeeper::time_split_timer::table).filter(timekeeper::time_split_timer::deleted.eq(false))))]
pub struct Timer {
    pub time_split_timer: Option<i32>,
    pub start_time: Timestamptz,
    pub end_time: Timestamptz,
    pub tags: Vec<Option<i32>>,
    #[cfg_attr(feature = "diesel", diesel(embed))]
    pub time_split_data: TimeSplitData,
}

impl Timer {
    pub fn placeholder() -> Self {
        Self {
            time_split_timer: Some(36),
            start_time: Timestamptz(Timestamp::now()),
            end_time: Timestamptz(Timestamp::now() + SignedDuration::from_hours(1)),
            tags: vec![Some(54), Some(45), Some(78), Some(23)],
            time_split_data: TimeSplitData::placeholder(),
        }
    }
}

#[cfg_attr(feature = "utoipa", derive(IntoResponses, ToSchema))]
pub enum TimerArrayResponses<'a> {
    #[cfg_attr(feature = "utoipa", response(status = 200))]
    Success(Vec<Timer>),
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
pub enum TimerResponses<'a> {
    #[cfg_attr(feature = "utoipa", response(status = 200))]
    Success(Timer),
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
    path = "/timekeeper/timer",
    summary = "Post a timer",
    description = "Upon starting a new timer, the Unix timestamp of when the timer was started, as well as the Unix timestamp in the future when the timer will end should be sent to this service. The ID of the time split, whether the timer is a work or a break timer, and the tag IDs associated with the timer should also be sent.",
    tag = "Timer",
    responses(TimerResponses),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct PostTimerRoute {
    #[body]
    pub timer: InsertableTimer,
}

#[derive(IntoPath)]
#[api_path(
    get,
    path = "/timekeeper/timer",
    summary = "Retreive a timer",
    description = "Retreives the most recently started/ended timer if no parameters are specified. Otherwise returns the timers that match the parameters.",
    tag = "Timer",
    responses(TimerArrayResponses),
    security(
        ("bearer_jwt" = []),
        ()
    )
)]
pub struct GetTimerRoute {}

#[derive(IntoPath)]
#[api_path(
    put,
    path = "/timekeeper/timer",
    summary = "Modify a timer",
    description = "This route replaces the fields of the timer at the passed in start time with new fields. When a timer is paused, this route should be used to change the end_timestamp of the timer to the Unix timestamp at which the timer was paused. To resume a timer, a new timer should be posted with the Unix timestamp at which the timer was resumed, and the Unix timestamp in the future at which the remaining time will have elapsed.",
    tag = "Timer",
    responses(TimerResponses),
    security(
        ("bearer_jwt" = []),
    )
)]
pub struct ModifyTimerRoute {
    #[body]
    pub timer: InsertableTimer,
}
