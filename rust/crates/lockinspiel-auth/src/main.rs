use aws_lc_rs::signature::{ECDSA_P256_SHA256_FIXED_SIGNING, EcdsaKeyPair};
use axum::{
    Json,
    extract::{FromRef, State},
    http::StatusCode,
    routing::get,
};
use color_eyre::eyre::{self, Context};
use jsonwebtoken::{
    EncodingKey,
    jwk::{Jwk, JwkSet},
};
use lockinspiel_backend_common::{
    ApiState, NoExtraArgs, ServiceConfig,
    auth::JWT_ALG,
    error::{EyreError, WithStatusCode},
    shutdown_signal,
};
use tokio::net::TcpListener;
use tracing::{Instrument, info_span, instrument};
use utoipa_axum::{router::OpenApiRouter, routes};
use utoipa_scalar::{Scalar, Servable};

pub mod routes;

#[derive(Clone, FromRef)]
pub struct AuthApiState {
    api_state: ApiState,
    encoding_key: EncodingKey,
    jwt_header: jsonwebtoken::Header,
}

macro_rules! app_routes {
    ($state:ty) => {
        [
            routes!(routes::signup, routes::delete_user),
            routes!(routes::new_session, routes::logout),
        ]
        .into_iter()
        .fold(OpenApiRouter::<$state>::new(), |router, routes| {
            router.routes(routes)
        })
        .split_for_parts()
    };
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let service_config = ServiceConfig::new("auth");
    let service_id = service_config.id.clone();
    let (init_state, api_state) = lockinspiel_backend_common::init::<NoExtraArgs>(
        service_config,
        lockinspiel_auth_schema::MIGRATIONS,
    )
    .await
    .wrap_err("Failed to initialize API state")?;

    // The key pair we generate is only compatible with
    // this algorithm
    assert_eq!(JWT_ALG, jsonwebtoken::Algorithm::ES256);

    let jwt_key_pair = EcdsaKeyPair::generate(&ECDSA_P256_SHA256_FIXED_SIGNING)
        .wrap_err("Failed to generate ECDSA keypair")?;

    let encoding_key = EncodingKey::from_ec_der(
        jwt_key_pair
            .to_pkcs8v1()
            .wrap_err("Failed to serialize encoding key to DER")?
            .as_ref(),
    );

    let mut jwk = Jwk::from_encoding_key(&encoding_key, JWT_ALG)
        .wrap_err("Failed to create JWK from JWT EncodingKey")?;

    let key_id = Some(format!(
        "{}.{}",
        jwk.thumbprint(jsonwebtoken::jwk::ThumbprintHash::SHA256),
        service_id
    ));
    jwk.common.key_id = key_id.clone();

    let mut jwt_header = jsonwebtoken::Header::new(JWT_ALG);
    jwt_header.jwk = Some(jwk.clone());
    jwt_header.kid = key_id;

    let jwk_set = JwkSet { keys: vec![jwk] };

    let (router, mut api) = app_routes!(AuthApiState);

    lockinspiel_backend_common::fill_in_openapi(&mut api);

    let app = router
        .route("/", get(|| async { "up" }))
        .route(
            "/.well-known/jwks.json",
            get(move || async move { Json(jwk_set) }.instrument(info_span!("well_known_jwks"))),
        )
        .route("/auth/.well-known/jwks.json", get(auth_jwk_set))
        .merge(Scalar::with_url("/auth/openapi", api))
        .route(
            "/auth/openapi/json",
            get(async move || Json(app_routes!(AuthApiState).1)),
        )
        .layer(lockinspiel_backend_common::layer())
        .with_state(AuthApiState {
            api_state,
            encoding_key,
            jwt_header,
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

#[instrument(skip(api_state))]
async fn auth_jwk_set(State(api_state): State<ApiState>) -> Result<Json<JwkSet>, EyreError> {
    let jwk_set = api_state.jwk_set.retreiver();

    Ok::<_, EyreError>(Json(
        jwk_set
            .get_new_jwks()
            .await
            .wrap_err("Failed to retreive JWKs from JWK retreiver")
            .with_status_code(StatusCode::INTERNAL_SERVER_ERROR)?,
    ))
}
