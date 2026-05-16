use std::{
    convert::Infallible,
    net::{Ipv6Addr, SocketAddr, SocketAddrV6},
    sync::Arc,
};

use axum::{extract::Request, response::IntoResponse, routing::Route};
use clap::{Args, Parser};
use color_eyre::{
    config::Theme,
    eyre::{self, Context, bail},
};
use diesel_async::{
    AsyncConnection, AsyncMigrationHarness,
    pooled_connection::{AsyncDieselConnectionManager, ManagerConfig, bb8},
};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness};
use futures_util::FutureExt;
use opentelemetry::trace::TracerProvider;
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_sdk::{logs::SdkLoggerProvider, trace::SdkTracerProvider};
use serde::{Deserialize, de::DeserializeOwned};
use tokio::signal;
use tower::{Layer, Service, ServiceBuilder};
use tower_http::{
    catch_panic::CatchPanicLayer,
    compression::CompressionLayer,
    trace::{DefaultMakeSpan, TraceLayer},
};
use tracing::Level;
use tracing_error::ErrorLayer;
use tracing_opentelemetry::OpenTelemetryLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::openapi::{
    Info, License, OpenApi,
    security::{ApiKey, ApiKeyValue, Http, HttpAuthScheme, SecurityScheme},
};

use crate::{
    auth::{Pool, REFRESH_TOKEN_NAME},
    cli_level_filter::CliLevelFilter,
    jwk_set::JwkSetManager,
    telemetry::{
        DieselInstrumentation, TelemetryMakeSpan, init_logging_provider, init_tracing_provider,
    },
};

mod cli_level_filter;

pub mod auth;
pub mod error;
pub mod jwk_set;
pub mod sql_types;
pub mod telemetry;
pub mod users;

pub trait Placeholder {
    fn placeholder() -> Self;
}

#[inline]
const fn default_listen_addr() -> SocketAddr {
    SocketAddr::V6(SocketAddrV6::new(Ipv6Addr::UNSPECIFIED, 3000, 0, 0))
}

#[derive(Debug)]
pub struct ServiceConfig {
    /// The type of the service
    pub service_type: &'static str,
    /// A unique ID for the instance
    /// of the service
    pub id: String,
}

impl ServiceConfig {
    pub fn new(service_type: &'static str) -> Self {
        Self {
            service_type,
            id: std::env::var("HOSTNAME")
                .or_else(|_| std::env::var("SERVICE_ID"))
                .unwrap_or_else(|_| service_type.to_owned()),
        }
    }
}

#[derive(Parser, Deserialize, Default)]
pub struct NoExtraArgs {}

#[derive(Parser, Deserialize)]
#[command(version, about, long_about = None)]
#[command(propagate_version = true)]
#[serde(bound = "E: Deserialize<'de> + Default")]
struct Cli<E: Args> {
    #[clap(short, long, env = "RUST_LOG")]
    #[serde(default)]
    log_level: CliLevelFilter,
    #[clap(short, long, env = "LISTEN_ADDR")]
    #[serde(default = "default_listen_addr")]
    addr: SocketAddr,
    #[clap(long, env = "AUTH_SERVICE")]
    #[serde(default)]
    auth_service: String,
    #[clap(short, long, env = "DATABASE_URL")]
    #[serde(default)]
    db_url: String,
    #[clap(long, env = "OTEL_EXPORTER_OTLP_ENDPOINT")]
    #[serde(default)]
    otlp_endpoint: Option<String>,
    #[clap(flatten)]
    #[serde(default)]
    service: E,
}

impl<'de, E: Default + Args + Deserialize<'de>> Default for Cli<E> {
    fn default() -> Self {
        Self {
            log_level: CliLevelFilter::default(),
            addr: default_listen_addr(),
            auth_service: String::new(),
            db_url: String::new(),
            otlp_endpoint: None,
            service: E::default(),
        }
    }
}

#[derive(Clone)]
pub struct ApiState {
    pub pool: Pool,
    pub reqwest_client: reqwest::Client,
    pub jwk_set: Arc<JwkSetManager>,
}

pub struct InitState<E> {
    pub addr: SocketAddr,
    pub service_config: E,
    pub tracer_provider: Option<SdkTracerProvider>,
    pub logger_provider: Option<SdkLoggerProvider>,
}

impl<E> InitState<E> {
    pub fn shutdown(&self) -> eyre::Result<()> {
        if let Some(tracer) = &self.tracer_provider {
            tracer
                .shutdown()
                .wrap_err("Failed to shut down tracing service")?;
        }
        if let Some(logger) = &self.logger_provider {
            logger
                .shutdown()
                .wrap_err("Failed to shut down logging service")?
        }

        Ok(())
    }
}

pub async fn init<E: Args + DeserializeOwned + Default>(
    service: ServiceConfig,
    migrations: EmbeddedMigrations,
) -> eyre::Result<(InitState<E>, ApiState)> {
    dotenvy::dotenv().ok();
    let color = supports_color::on(supports_color::Stream::Stderr)
        .map(|c| c.has_basic)
        .unwrap_or_default();

    color_eyre::config::HookBuilder::default()
        .theme(if color {
            Theme::dark()
        } else {
            Theme::default()
        })
        .display_env_section(false)
        .install()?;

    let mut config: Cli<E> = match std::fs::read_to_string(format!("{}.tson", service.service_type))
    {
        Ok(file) => tysonscript_object_notation::from_str(&file)
            .wrap_err("Failed to deserialize config file")?,
        Err(e) => {
            eprintln!("Failed to open config file: {}", e);
            eprintln!("Using default config");
            Cli::default()
        }
    };
    config.update_from(std::env::args_os());

    let tracer_provider = init_tracing_provider(&service, config.otlp_endpoint.as_deref());
    let logger_provider = init_logging_provider(&service, config.otlp_endpoint.as_deref());
    let tracer = tracer_provider
        .as_ref()
        .map(|t| t.tracer(format!("tracing-lockinspiel-{}", service.service_type)));

    let registry = tracing_subscriber::registry()
        .with(ErrorLayer::default())
        .with(config.log_level.0)
        .with(tracing_subscriber::fmt::layer().with_ansi(color));

    if let (Some(tracer), Some(logger)) = (tracer, &logger_provider) {
        registry
            .with(OpenTelemetryLayer::new(tracer))
            .with(OpenTelemetryTracingBridge::new(logger))
            .init();
    } else {
        registry.init();
    }

    if config.db_url.is_empty() {
        bail!("db_url is not set");
    }

    let mut manager_config = ManagerConfig::default();
    manager_config.custom_setup = Box::new(|url| {
        diesel_async::AsyncPgConnection::establish(url)
            .map(|conn| {
                conn.map(|mut c| {
                    c.set_instrumentation(DieselInstrumentation::default());
                    c
                })
            })
            .boxed()
    });

    let db_config =
        AsyncDieselConnectionManager::<diesel_async::AsyncPgConnection>::new_with_config(
            config.db_url,
            manager_config,
        );
    let pool = bb8::Pool::builder()
        .build(db_config)
        .await
        .wrap_err("Failed to build database pool")?;

    let mut harness = AsyncMigrationHarness::new(
        pool.get_owned()
            .await
            .wrap_err("Failed to get owned connection to database")?,
    );
    // SAFETY: Box<dyn Error + Send + Sync> is not also 'static,
    // so must use unwrap
    harness.run_pending_migrations(migrations).unwrap();

    let reqwest_client = reqwest::Client::new();

    Ok((
        InitState {
            addr: config.addr,
            service_config: config.service,
            tracer_provider,
            logger_provider,
        },
        ApiState {
            pool: Pool::new(pool),
            reqwest_client,
            jwk_set: Arc::new(
                JwkSetManager::new(&config.auth_service)
                    .wrap_err("Failed to create a JWK set manager")?,
            ),
        },
    ))
}

pub fn fill_in_openapi(api: &mut OpenApi) {
    api.info = Info::builder()
        .title(env!("CARGO_PKG_NAME"))
        .description(option_env!("CARGO_PKG_DESCRIPTION"))
        .version(env!("CARGO_PKG_VERSION"))
        .license(
            option_env!("CARGO_PKG_LICENSE")
                .map(|license| License::builder().identifier(Some(license)).build()),
        )
        .contact(None)
        .build();
    api.components.as_mut().map(|components| {
        components.security_schemes.insert(
            "bearer_jwt".to_owned(),
            SecurityScheme::Http(
                Http::builder()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .build(),
            ),
        );
        components.security_schemes.insert(
            "refresh_cookie".to_owned(),
            SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::with_description(
                REFRESH_TOKEN_NAME,
                "An HTTP-Only cookie issued on signup and login",
            ))),
        );
        // components.security_schemes.insert(
        //     "basic_auth".to_owned(),
        //     SecurityScheme::Http(
        //         Http::builder()
        //             .scheme(HttpAuthScheme::Basic)
        //             // .bearer_format("JWT")
        //             .build(),
        //     ),
        // );
    });
}

// We love trait bounds
pub fn layer() -> ServiceBuilder<
    impl Layer<
        Route,
        Service = impl Service<
            Request,
            Response = impl IntoResponse,
            Error = impl Into<Infallible>,
            Future = impl Future + Send,
        > + Clone
                  + Send
                  + Sync,
    > + Clone
    + Send
    + Sync,
> {
    ServiceBuilder::new()
        .layer(CatchPanicLayer::custom(error::PanicHandler))
        .layer(CompressionLayer::new().br(true).gzip(true))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(TelemetryMakeSpan(DefaultMakeSpan::new().level(Level::INFO))),
        )
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
