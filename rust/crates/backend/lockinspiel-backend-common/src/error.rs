use std::{
    borrow::Cow,
    fmt::{Debug, Display},
};

use axum::{Json, body::Body, http::StatusCode, response::IntoResponse};
use color_eyre::eyre::{Report, eyre};
use serde::{
    Deserialize, Serialize,
    ser::{SerializeSeq, SerializeStruct},
};
use tower_http::catch_panic::ResponseForPanic;
use tracing_error::SpanTrace;
use utoipa::ToSchema;

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

impl<E: Display> IntoResponse for Error<E>
where
    Error<E>: Into<EyreError>,
{
    fn into_response(self) -> axum::response::Response {
        self.into().into_response()
    }
}

#[derive(Deserialize, Serialize, ToSchema)]
struct Frame<'a> {
    module_path: Option<Cow<'a, str>>,
    name: Cow<'a, str>,
    file: Option<Cow<'a, str>>,
    line: Option<u32>,
    fields: Cow<'a, str>,
}

struct SerializeChain<'a>(&'a Report);

impl Serialize for SerializeChain<'_> {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let chain = self.0.chain();
        let mut seq = serializer.serialize_seq(Some(chain.len()))?;
        for error in chain {
            seq.serialize_element(&format!("{}", error))?;
        }
        seq.end()
    }
}

struct SerializeSpantrace<'a>(&'a SpanTrace);

impl Serialize for SerializeSpantrace<'_> {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut result = Ok(());
        let mut seq = serializer.serialize_seq(None)?;
        self.0.with_spans(|span, fields| {
            if let Err(e) = seq.serialize_element(&Frame {
                module_path: span.module_path().map(Cow::Borrowed),
                name: Cow::Borrowed(span.name()),
                file: span.file().map(Cow::Borrowed),
                line: span.line(),
                fields: Cow::Borrowed(fields),
            }) {
                result = Err(e);
                false
            } else {
                true
            }
        });
        result?;
        seq.end()
    }
}

#[derive(Deserialize, ToSchema)]
#[schema(examples(EyreErrorWrapper::placeholder))]
struct EyreErrorWrapper<'a> {
    #[serde(skip)]
    error: Option<Report>,
    chain: Vec<Cow<'a, str>>,
    spantrace: Vec<Frame<'a>>,
}

impl From<Report> for EyreErrorWrapper<'_> {
    fn from(value: Report) -> Self {
        Self {
            error: Some(value),
            chain: Vec::new(),
            spantrace: Vec::new(),
        }
    }
}

impl Placeholder for EyreErrorWrapper<'_> {
    fn placeholder() -> Self {
        Self {
            error: None,
            chain: vec![Cow::Borrowed("Uh oh!"), Cow::Borrowed("Something happened")],
            spantrace: vec![Frame {
                module_path: Some(Cow::Borrowed("path::to::something")),
                name: Cow::Borrowed("thing"),
                file: Some(Cow::Borrowed(file!())),
                line: Some(line!()),
                fields: Cow::Borrowed("foo=bar this=that"),
            }],
        }
    }
}

impl Serialize for EyreErrorWrapper<'_> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut obj = serializer.serialize_struct("Error", 2)?;

        if let Some(error) = &self.error {
            obj.serialize_field("chain", &SerializeChain(error))?;
            let handler: &color_eyre::Handler = error.handler().downcast_ref().unwrap();
            obj.serialize_field(
                "spantrace",
                &SerializeSpantrace(handler.span_trace().unwrap()),
            )?;
        } else {
            obj.serialize_field("chain", &self.chain)?;
            obj.serialize_field("spantrace", &self.spantrace)?;
        }

        obj.end()
    }
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct EyreError {
    #[serde(skip)]
    status_code: StatusCode,
    error: EyreErrorWrapper<'static>,
}

impl IntoResponse for EyreError {
    fn into_response(self) -> axum::response::Response {
        (self.status_code, Json(self)).into_response()
    }
}

impl Placeholder for EyreError {
    fn placeholder() -> Self {
        Self {
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
            error: EyreErrorWrapper::placeholder(),
        }
    }
}

impl<E> From<Error<E>> for EyreError
where
    E: AsStatusCode,
    E: Send + Sync + std::error::Error + 'static,
{
    fn from(value: Error<E>) -> Self {
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
