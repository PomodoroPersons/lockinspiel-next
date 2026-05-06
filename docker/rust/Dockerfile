ARG SERVICE

FROM lukemathwalker/cargo-chef:latest-rust-1.94.0 AS chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder-rs 
ARG SERVICE
RUN apt-get update; \
  apt-get upgrade -y; \
  apt-get install cmake -y
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this is the caching Docker layer!
RUN cargo chef cook --release --recipe-path recipe.json
# Build application
COPY . .
RUN cargo build --release

FROM debian:trixie-slim AS runtime-base
RUN apt-get update; \
  apt-get upgrade -y; \
  apt-get install curl dnsutils -y
WORKDIR /app


# We do not need the Rust toolchain to run the binary!
FROM runtime-base AS runtime
ARG SERVICE
COPY ./docker/rust/docker-entrypoint.sh /usr/local/bin
COPY --from=builder-rs "/app/target/release/lockinspiel-$SERVICE" /usr/local/bin/app

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/local/bin/app"]
