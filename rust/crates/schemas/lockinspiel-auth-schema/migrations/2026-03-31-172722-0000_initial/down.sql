DROP TABLE auth.refresh_tokens;
DROP TABLE auth.users;
DROP FUNCTION auth.set_uid;
DROP FUNCTION auth.uid;
REVOKE USAGE ON SCHEMA auth FROM PUBLIC;
