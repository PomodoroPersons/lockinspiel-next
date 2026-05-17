use diesel::{
    backend::Backend,
    data_types::PgTimestamp,
    deserialize::{self, FromSql, FromSqlRow},
    expression::AsExpression,
    pg::{Pg, PgValue},
    serialize::{self, Output, ToSql},
    sql_types,
};
use jiff::{SignedDuration, civil};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use utoipa::ToSchema;

use crate::Placeholder;

#[repr(transparent)]
#[derive(Debug, PartialEq, AsExpression, FromSqlRow)]
#[diesel(sql_type = sql_types::Binary)]
pub struct DieselByteA<const N: usize>(pub [u8; N]);

impl<ST, DB, const N: usize> FromSql<ST, DB> for DieselByteA<N>
where
    DB: Backend,
    *const [u8]: FromSql<ST, DB>,
{
    #[allow(unsafe_code)] // ptr dereferencing
    fn from_sql(bytes: DB::RawValue<'_>) -> deserialize::Result<Self> {
        let slice_ptr = <*const [u8] as FromSql<ST, DB>>::from_sql(bytes)?;
        // We know that the pointer impl will never return null
        let bytes = unsafe { &*slice_ptr };
        let result: [u8; N] = bytes.try_into()?;
        Ok(DieselByteA(result))
    }
}

impl<const N: usize> From<DieselByteA<N>> for [u8; N] {
    fn from(value: DieselByteA<N>) -> Self {
        value.0
    }
}

impl<const N: usize> From<[u8; N]> for DieselByteA<N> {
    fn from(value: [u8; N]) -> Self {
        DieselByteA(value)
    }
}

impl<DB, const N: usize> ToSql<sql_types::Binary, DB> for DieselByteA<N>
where
    DB: Backend,
    [u8]: ToSql<sql_types::Binary, DB>,
{
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, DB>) -> serialize::Result {
        self.0.as_slice().to_sql(out)
    }
}

impl<const N: usize> Placeholder for DieselByteA<N> {
    fn placeholder() -> Self {
        Self([0; N])
    }
}

// A lot of this is pulled directly out of the diesel source code
//
// https://docs.rs/diesel/latest/src/diesel/pg/types/date_and_time/std_time.rs.html
// https://docs.rs/diesel/latest/src/diesel/pg/types/date_and_time/chrono.rs.html

fn pg_epoch_datetime() -> civil::DateTime {
    civil::DateTime::new(2000, 1, 1, 0, 0, 0, 0).expect("This is in supported range of jiff dates")
}

#[repr(transparent)]
#[derive(Debug, PartialEq, AsExpression, FromSqlRow)]
#[diesel(sql_type = sql_types::Timestamp)]
pub struct DateTime(pub civil::DateTime);

impl FromSql<sql_types::Timestamp, Pg> for DateTime {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<Self> {
        let PgTimestamp(offset) = FromSql::<sql_types::Timestamp, Pg>::from_sql(bytes)?;
        match pg_epoch_datetime().checked_add(SignedDuration::from_micros(offset)) {
            Ok(v) => Ok(DateTime(v)),
            Err(e) => {
                let message = format!(
                    "Tried to deserialize a timestamp that is too large for Jiff: `{}`",
                    e
                );
                Err(message.into())
            }
        }
    }
}

impl FromSql<sql_types::Timestamptz, Pg> for DateTime {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<Self> {
        FromSql::<sql_types::Timestamp, Pg>::from_sql(bytes)
    }
}

#[repr(transparent)]
#[derive(Debug, Clone, Default, PartialEq, AsExpression, FromSqlRow, Deserialize, Serialize)]
#[diesel(sql_type = sql_types::Timestamp)]
pub struct Timestamp(pub jiff::Timestamp);

pub fn pg_epoch_timestamp() -> jiff::Timestamp {
    let thirty_years = SignedDuration::from_secs(946_684_800);
    jiff::Timestamp::UNIX_EPOCH + thirty_years
}

const USEC_PER_SEC: i64 = 1_000_000;
const NANO_PER_USEC: i32 = 1_000;

fn usecs_to_duration(usecs_passed: i64) -> SignedDuration {
    let seconds = usecs_passed / USEC_PER_SEC;
    let subsecond_usecs = usecs_passed % USEC_PER_SEC;
    let subseconds = subsecond_usecs as i32 * NANO_PER_USEC;
    SignedDuration::new(seconds, subseconds)
}

fn duration_to_usecs(duration: SignedDuration) -> i64 {
    let seconds = duration.as_secs() * USEC_PER_SEC;
    let subseconds = duration.subsec_micros();
    seconds + i64::from(subseconds)
}

impl FromSql<sql_types::Timestamp, Pg> for Timestamp {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<Self> {
        let usecs_passed = <i64 as FromSql<sql_types::BigInt, Pg>>::from_sql(bytes)?;
        let before_epoch = usecs_passed < 0;
        let time_passed = usecs_to_duration(usecs_passed.abs());

        if before_epoch {
            Ok(Timestamp(pg_epoch_timestamp() - time_passed))
        } else {
            Ok(Timestamp(pg_epoch_timestamp() + time_passed))
        }
    }
}

impl FromSql<sql_types::Timestamptz, Pg> for Timestamp {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<Self> {
        FromSql::<sql_types::Timestamp, Pg>::from_sql(bytes)
    }
}

// From https://github.com/PPakalns/diesel_json/blob/9443c0168952bf2cb4ef156c9771438f9632ede0/src/lib.rs
#[derive(FromSqlRow, AsExpression, ToSchema, Serialize, Deserialize, Debug, Clone)]
#[serde(transparent)]
#[diesel(sql_type = sql_types::Jsonb)]
pub struct Json<T: Sized>(pub T);

impl<T> Json<T> {
    pub fn new(value: T) -> Json<T> {
        Json(value)
    }
}

impl<T> FromSql<sql_types::Jsonb, Pg> for Json<T>
where
    T: std::fmt::Debug + DeserializeOwned,
{
    fn from_sql(bytes: PgValue) -> diesel::deserialize::Result<Self> {
        let value = <serde_json::Value as FromSql<sql_types::Jsonb, Pg>>::from_sql(bytes)?;
        Ok(Json(serde_json::from_value::<T>(value)?))
    }
}

impl<T> ToSql<sql_types::Jsonb, Pg> for Json<T>
where
    T: std::fmt::Debug + Serialize,
{
    fn to_sql(&self, out: &mut diesel::serialize::Output<Pg>) -> diesel::serialize::Result {
        let value = serde_json::to_value(self)?;
        <serde_json::Value as ToSql<sql_types::Jsonb, Pg>>::to_sql(&value, &mut out.reborrow())
    }
}
