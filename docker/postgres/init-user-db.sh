#!/usr/bin/env bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE USER docker WITH PASSWORD '$POSTGRES_PASSWORD';
	CREATE USER otelu WITH PASSWORD '$POSTGRES_PASSWORD';
	CREATE DATABASE docker;
	GRANT ALL PRIVILEGES ON DATABASE docker TO docker;
	GRANT pg_monitor TO otelu;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "docker" <<-EOSQL
	CREATE EXTENSION IF NOT EXISTS timescaledb;
	CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
	GRANT USAGE, CREATE ON SCHEMA public TO docker;
	CREATE ROLE "anon";
	CREATE ROLE "authenticator";
	CREATE ROLE "authenticated";
	GRANT anon TO docker;
	GRANT anon TO authenticated;
	GRANT authenticator TO docker;
	GRANT authenticated TO docker;
EOSQL

