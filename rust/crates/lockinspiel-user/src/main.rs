use axum::{Json, extract::FromRef, routing::get};
use color_eyre::eyre::{self, Context};
use lockinspiel_backend_common::{ApiState, ServiceConfig, shutdown_signal};
use tokio::net::TcpListener;
use utoipa_axum::router::OpenApiRouter;
use utoipa_scalar::{Scalar, Servable};

pub mod routes;
pub mod templating;

#[derive(Clone, FromRef)]
pub struct UserApiState {
    api_state: ApiState,
}

macro_rules! app_routes {
    ($state:ty) => {
        [].into_iter()
            .fold(OpenApiRouter::<$state>::new(), |router, routes| {
                router.routes(routes)
            })
            .split_for_parts()
    };
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let service_config = ServiceConfig::new("user");
    let (init_state, api_state) =
        lockinspiel_backend_common::init(service_config, lockinspiel_user_schema::MIGRATIONS)
            .await
            .wrap_err("Failed to initialize API state")?;

    let (router, mut api) = app_routes!(UserApiState);

    lockinspiel_backend_common::fill_in_openapi(&mut api);

    let app = router
        .route("/", get(|| async { "up" }))
        .merge(Scalar::with_url("/user/openapi", api))
        .route(
            "/user/openapi/json",
            get(async move || Json(app_routes!(UserApiState).1)),
        )
        .layer(lockinspiel_backend_common::layer())
        .with_state(UserApiState { api_state });

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
