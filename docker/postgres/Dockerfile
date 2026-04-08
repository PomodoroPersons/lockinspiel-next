FROM timescale/timescaledb:latest-pg18 AS base

FROM base AS main
RUN mkdir -p /docker-entrypoint-initdb.d
COPY ./init-user-db.sh /docker-entrypoint-initdb.d/10_userdb.sh
