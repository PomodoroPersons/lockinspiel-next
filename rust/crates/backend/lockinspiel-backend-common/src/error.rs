use axum::{Json, body::Body, http::StatusCode, response::IntoResponse};
use color_eyre::eyre::{Report, eyre};
use serde::{Deserialize, Serialize};
use tower_http::catch_panic::ResponseForPanic;

use crate::Placeholder;
use lockinspiel_common_schema::error::{Error, EyreErrorWrapper};

pub trait AsStatusCode {
    fn status_code(&self) -> StatusCode;
}

impl AsStatusCode for StatusCode {
    fn status_code(&self) -> StatusCode {
        *self
    }
}

impl Placeholder for EyreErrorWrapper<'_> {
    fn placeholder() -> Self {
        Self::placeholder()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EyreError {
    #[serde(skip)]
    status_code: StatusCode,
    error: EyreErrorWrapper<'static>,
}

impl IntoResponse for EyreError {
    fn into_response(self) -> axum::response::Response {
        (self.status_code, Json(self.error)).into_response()
    }
}

impl<E> From<Error<E, EyreError>> for EyreError
where
    E: AsStatusCode,
    E: Send + Sync + std::error::Error + 'static,
{
    fn from(value: Error<E, EyreError>) -> Self {
        let status_code = value.source.status_code();
        let error: Report = value.into();

        Self {
            status_code,
            error: EyreErrorWrapper::from(error),
        }
    }
}

#[derive(Clone, Copy)]
pub struct PanicHandler;

impl ResponseForPanic for PanicHandler {
    type ResponseBody = Body;

    fn response_for_panic(
        &mut self,
        err: Box<dyn std::any::Any + Send + 'static>,
    ) -> axum::http::Response<Self::ResponseBody> {
        let error_string = if let Some(s) = err.downcast_ref::<String>() {
            tracing::error!("Service panicked: {}", s);
            s.as_str()
        } else if let Some(s) = err.downcast_ref::<&str>() {
            tracing::error!("Service panicked: {}", s);
            s
        } else {
            let s = "Service panicked but `CatchPanic` was unable to downcast the panic inf
o";
            tracing::error!("{}", s);
            s
        };

        EyreError {
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
            error: EyreErrorWrapper::from(eyre!("{}", error_string)),
        }
        .into_response()
    }
}

pub trait WithStatusCode<T> {
    fn with_status_code(self, status_code: StatusCode) -> Result<T, EyreError>;
}

impl<T> WithStatusCode<T> for std::result::Result<T, Report> {
    fn with_status_code(self, status_code: StatusCode) -> Result<T, EyreError> {
        self.map_err(|error| EyreError {
            status_code,
            error: error.into(),
        })
    }
}
