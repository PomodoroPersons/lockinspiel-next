FROM lukemathwalker/cargo-chef:latest-rust-1.94.0 AS chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder-rs 
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this is the caching Docker layer!
RUN cargo chef cook --release --recipe-path recipe.json
# Build application
COPY ./crates/backend/lockinspiel-backend-common ./crates/backend/lockinspiel-backend-common
COPY ./crates/utoipa-e2e ./crates/utoipa-e2e 
COPY ./crates/schemas ./crates/schemas
ARG SERVICE
COPY ./crates/backend/$SERVICE ./crates/backend/$SERVICE
COPY ./crates/backend/$SERVICE/static* ./crates/backend/$SERVICE/static
RUN cargo build --release --bin $SERVICE

FROM debian:trixie-slim AS runtime-base
RUN apt-get update \
  && apt-get install --no-install-recommends curl dnsutils -y \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app


# We do not need the Rust toolchain to run the binary!
FROM runtime-base AS runtime
COPY ./docker-entrypoint.sh /usr/local/bin
ARG SERVICE
COPY --from=builder-rs "/app/target/release/$SERVICE" /usr/local/bin/app

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/local/bin/app"]
