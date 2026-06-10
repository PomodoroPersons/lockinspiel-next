use std::{
    borrow::Cow,
    fmt::{Debug, Display},
};

use axum::{
    body::Body,
    http::StatusCode,
    response::{Html, IntoResponse},
};
use color_eyre::eyre::eyre;
use tower_http::catch_panic::ResponseForPanic;
use tracing::instrument;

use crate::Placeholder;

pub trait AsStatusCode {
    fn status_code(&self) -> StatusCode;
}

impl AsStatusCode for StatusCode {
    fn status_code(&self) -> StatusCode {
        *self
    }
}

pub trait WithReason<O, E> {
    fn with_reason(self, reason: impl Into<Cow<'static, str>>) -> Result<O, Error<E>>;
    fn no_additional_reason(self) -> Result<O, Error<E>>;
}

#[derive(Debug)]
pub struct Error<E> {
    msg: Option<Cow<'static, str>>,
    pub source: E,
}

impl<E: std::error::Error + 'static> std::error::Error for Error<E> {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&self.source)
    }
}

impl<E: Display> Display for Error<E> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(msg) = &self.msg {
            write!(f, "{}", msg)
        } else {
            self.source.fmt(f)
        }
    }
}

impl<O, E, I> WithReason<O, I> for Result<O, E>
where
    E: Into<I>,
{
    fn with_reason(self, reason: impl Into<Cow<'static, str>>) -> Result<O, Error<I>> {
        self.map_err(|e| Error {
            msg: Some(reason.into()),
            source: e.into(),
        })
    }

    fn no_additional_reason(self) -> Result<O, Error<I>> {
        self.map_err(|e| Error {
            msg: None,
            source: e.into(),
        })
    }
}

impl<E> From<Error<E>> for EyreError
where
    E: AsStatusCode,
    E: Send + Sync + std::error::Error + 'static,
{
    fn from(value: Error<E>) -> Self {
        Self {
            status_code: value.source.status_code(),
            error: value.into(),
        }
    }
}

impl<E: Display> IntoResponse for Error<E>
where
    Error<E>: Into<EyreError>,
{
    fn into_response(self) -> axum::response::Response {
        self.into().into_response()
    }
}

pub struct EyreError {
    status_code: StatusCode,
    error: color_eyre::eyre::Report,
}

impl utoipa::PartialSchema for EyreError {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::Schema> {
        utoipa::openapi::RefOr::T(utoipa::openapi::Schema::Object(
            utoipa::openapi::ObjectBuilder::new()
                .schema_type(utoipa::openapi::schema::SchemaType::new(
                    utoipa::openapi::Type::String,
                ))
                .build(),
        ))
    }
}

impl utoipa::ToSchema for EyreError {
    fn name() -> std::borrow::Cow<'static, str> {
        std::borrow::Cow::Borrowed(stringify!($t))
    }

    fn schemas(_schemas: &mut Vec<(String, utoipa::openapi::RefOr<utoipa::openapi::Schema>)>) {}
}

impl Placeholder for EyreError {
    #[instrument]
    fn placeholder() -> Self {
        Self {
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
            error: eyre!("Example error"),
        }
    }
}

impl Display for EyreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.error.handler().display(self.error.as_ref(), f)
    }
}

impl Debug for EyreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.error.handler().debug(self.error.as_ref(), f)
    }
}

impl IntoResponse for EyreError {
    fn into_response(self) -> axum::response::Response {
        (self.status_code, Html(self.render())).into_response()
    }
}

impl EyreError {
    pub fn render(&self) -> String {
        let ansi_string = format!("{:?}", self);
        let error = ansi_to_html::convert(&ansi_string).unwrap();

        format!(
            "<!DOCTYPE html><html><head><meta charset=\"utf8\"></head><body><pre><code>{}</code></pre></body></html>",
            error
        )
    }

    pub fn render_placeholder() -> String {
        EyreError::placeholder().render()
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
            error: eyre!("{}", error_string),
        }
        .into_response()
    }
}

pub trait WithStatusCode<T> {
    fn with_status_code(self, status_code: StatusCode) -> Result<T, EyreError>;
}

impl<T> WithStatusCode<T> for std::result::Result<T, color_eyre::eyre::Report> {
    fn with_status_code(self, status_code: StatusCode) -> Result<T, EyreError> {
        self.map_err(|error| EyreError { status_code, error })
    }
}
