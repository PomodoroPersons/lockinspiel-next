use std::{
    borrow::Cow,
    fmt::{Debug, Display},
    marker::PhantomData,
};

use axum_core::response::IntoResponse;
use color_eyre::eyre::Report;
use serde::{
    Deserialize, Serialize,
    ser::{SerializeSeq, SerializeStruct},
};
use tracing_error::SpanTrace;
#[cfg(feature = "utoipa")]
use utoipa::ToSchema;

pub trait WithReason<O, E, R> {
    fn with_reason(self, reason: impl Into<Cow<'static, str>>) -> Result<O, Error<E, R>>;
    fn no_additional_reason(self) -> Result<O, Error<E, R>>;
}

#[derive(Debug)]
pub struct Error<E, R> {
    msg: Option<Cow<'static, str>>,
    response: PhantomData<R>,
    pub source: E,
}

impl<E: Display, R: IntoResponse> IntoResponse for Error<E, R>
where
    Error<E, R>: Into<R>,
{
    fn into_response(self) -> axum_core::response::Response {
        self.into().into_response()
    }
}

impl<O, E, I, R> WithReason<O, I, R> for Result<O, E>
where
    E: Into<I>,
{
    fn with_reason(self, reason: impl Into<Cow<'static, str>>) -> Result<O, Error<I, R>> {
        self.map_err(|e| Error {
            msg: Some(reason.into()),
            response: PhantomData,
            source: e.into(),
        })
    }

    fn no_additional_reason(self) -> Result<O, Error<I, R>> {
        self.map_err(|e| Error {
            msg: None,
            response: PhantomData,
            source: e.into(),
        })
    }
}

impl<E: std::error::Error + 'static, R: Debug> std::error::Error for Error<E, R> {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&self.source)
    }
}

impl<E: Display, R> Display for Error<E, R> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(msg) = &self.msg {
            write!(f, "{}", msg)
        } else {
            self.source.fmt(f)
        }
    }
}

#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[derive(Debug, Deserialize, Serialize)]
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

#[cfg_attr(feature = "utoipa", derive(ToSchema))]
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "utoipa", schema(examples(EyreErrorWrapper::placeholder)))]
pub struct EyreErrorWrapper<'a> {
    #[serde(skip)]
    error: Option<Report>,
    chain: Vec<Cow<'a, str>>,
    spantrace: Vec<Frame<'a>>,
}

impl EyreErrorWrapper<'_> {
    pub fn placeholder() -> Self {
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

impl From<Report> for EyreErrorWrapper<'_> {
    fn from(value: Report) -> Self {
        Self {
            error: Some(value),
            chain: Vec::new(),
            spantrace: Vec::new(),
        }
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
