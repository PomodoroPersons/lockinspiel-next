FROM clux/muslrust:stable AS chef
USER root
RUN curl -L --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh | bash
RUN cargo binstall --locked cargo-chef sccache
ENV RUSTC_WRAPPER=sccache \
    SCCACHE_GHA_ENABLED=true
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
COPY ./crates/schemas/lockinspiel-common-schema ./crates/schemas/lockinspiel-common-schema
COPY ./crates/utoipa-e2e ./crates/utoipa-e2e 
ARG SERVICE
COPY ./crates/schemas/$SERVICE-schema* ./crates/schemas/$SERVICE-schema
COPY ./crates/backend/$SERVICE ./crates/backend/$SERVICE
COPY ./crates/backend/$SERVICE/static* ./crates/backend/$SERVICE/static
RUN cargo build --release --bin $SERVICE

FROM alpine AS runtime
RUN apk add --no-cache curl bind-tools ca-certificates
WORKDIR /app

COPY ./docker-entrypoint.sh /usr/local/bin
ARG SERVICE
COPY --from=builder-rs "/app/target/release/$SERVICE" /usr/local/bin/app

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/local/bin/app"]
