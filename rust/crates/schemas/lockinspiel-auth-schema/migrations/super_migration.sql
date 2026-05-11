CREATE USER isaacm;
CREATE DATABASE isaacm;
GRANT ALL PRIVILEGES ON DATABASE isaacm TO isaacm;
CREATE DATABASE lockinspiel;
GRANT ALL PRIVILEGES ON DATABASE lockinspiel TO isaacm;

\c lockinspiel

CREATE EXTENSION IF NOT EXISTS timescaledb;
GRANT USAGE, CREATE ON SCHEMA public TO isaacm;

CREATE ROLE "anon";
CREATE ROLE "authenticator";
CREATE ROLE "authenticated";

GRANT anon TO isaacm;
GRANT anon TO authenticated;
GRANT authenticator TO isaacm;
GRANT authenticated TO isaacm;
