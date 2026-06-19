use std::sync::Arc;

use aws_sdk_s3::config::{BehaviorVersion, Credentials, Region, SharedCredentialsProvider};
use axum::{Json, extract::FromRef, routing::get};
use clap::Parser;
use color_eyre::eyre::{self, Context};
use lockinspiel_backend_common::{ApiState, ServiceConfig, shutdown_signal};
use serde::Deserialize;
use tokio::net::TcpListener;
use utoipa_axum::{router::OpenApiRouter, routes};
use utoipa_scalar::{Scalar, Servable};

use crate::url_resolver::UrlResolver;

pub mod routes;
pub mod url_resolver;

#[derive(Parser, Deserialize, Default)]
pub struct S3Config {
    #[clap(long = "s3-bucket-name", env = "S3_BUCKET_NAME")]
    #[serde(default)]
    name: String,
    #[clap(long = "s3-bucket-region", env = "S3_BUCKET_REGION")]
    #[serde(default)]
    region: Option<String>,
    #[clap(long = "s3-bucket-access-key", env = "S3_BUCKET_ACCESS_KEY")]
    #[serde(default)]
    access_key: String,
    #[clap(long = "s3-bucket-secret-key", env = "S3_BUCKET_SECRET_KEY")]
    #[serde(default)]
    secret_key: String,
    #[clap(long = "s3-bucket-path-style", env = "S3_BUCKET_PATH_STYLE")]
    #[serde(default)]
    path_style: bool,
    #[clap(long = "s3-bucket-endpoint", env = "S3_BUCKET_ENDPOINT")]
    #[serde(default)]
    endpoint: Option<String>,
    #[clap(long = "s3-bucket-endpoint", env = "S3_BUCKET_INTERNAL_ENDPOINT")]
    #[serde(default)]
    internal_endpoint: Option<String>,
}

#[derive(Parser, Deserialize, Default)]
pub struct UserConfig {
    #[clap(flatten)]
    #[serde(default)]
    s3_bucket: S3Config,
}

#[derive(Clone, FromRef)]
pub struct UserApiState {
    api_state: ApiState,
    url_resolver: Arc<UrlResolver>,
}

macro_rules! app_routes {
    ($state:ty) => {{
        let (router, mut api) = [
            routes!(
                routes::create_profile,
                routes::get_profile,
                routes::update_profile
            ),
            routes!(routes::put_avatar, routes::delete_avatar),
        ]
        .into_iter()
        .fold(OpenApiRouter::<$state>::new(), |router, routes| {
            router.routes(routes)
        })
        .split_for_parts();

        lockinspiel_backend_common::fill_in_openapi(&mut api);

        (router, api)
    }};
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let service_config = ServiceConfig::new("user");
    let (init_state, api_state) = lockinspiel_backend_common::init::<UserConfig>(
        service_config,
        lockinspiel_user_schema::MIGRATIONS,
    )
    .await
    .wrap_err("Failed to initialize API state")?;

    let mut s3_config = aws_sdk_s3::config::Builder::new()
        .behavior_version(BehaviorVersion::latest())
        .force_path_style(init_state.service_config.s3_bucket.path_style)
        .region(
            init_state
                .service_config
                .s3_bucket
                .region
                .clone()
                .map(|region| Region::new(region)),
        )
        .credentials_provider(SharedCredentialsProvider::new(
            Credentials::builder()
                .access_key_id(init_state.service_config.s3_bucket.access_key.clone())
                .secret_access_key(init_state.service_config.s3_bucket.secret_key.clone())
                .provider_name("idk what this means")
                .build(),
        ));

    s3_config.set_endpoint_url(init_state.service_config.s3_bucket.endpoint.clone());

    let s3_client = aws_sdk_s3::Client::from_conf(s3_config.build());

    let (router, api) = app_routes!(UserApiState);

    let app = router
        .route("/", get(|| async { "up" }))
        .merge(Scalar::with_url("/user/openapi", api))
        .route(
            "/user/openapi/json",
            get(async move || Json(app_routes!(UserApiState).1)),
        )
        .layer(lockinspiel_backend_common::layer())
        .with_state(UserApiState {
            api_state,
            url_resolver: Arc::new(UrlResolver::new(
                init_state.service_config.s3_bucket.name.clone(),
                init_state
                    .service_config
                    .s3_bucket
                    .internal_endpoint
                    .clone(),
                s3_client,
            )),
        });

    let listener = TcpListener::bind(init_state.addr)
        .await
        .wrap_err_with(|| format!("Failed to open listener on {}", init_state.addr))?;
    tracing::info!("Listening on {}", init_state.addr);

    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .wrap_err("Failed to serve make service")?;

    init_state
        .shutdown()
        .wrap_err("Failed to shutdown OpenTelemetry services")
}
