GRANT USAGE ON SCHEMA auth TO PUBLIC;

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_user_id', true)::uuid;
$$;

CREATE FUNCTION auth.set_uid(uid uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT set_config('app.current_user_id', uid::text, false);
$$;

CREATE TABLE auth.users(
    user_id uuid PRIMARY KEY DEFAULT generate_uuidv7(),
    username VARCHAR NOT NULL UNIQUE,
    pbkdf2_iterations INTEGER NOT NULL,
    salt BYTEA NOT NULL,
    password BYTEA NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'user'
);

GRANT INSERT, SELECT, UPDATE, DELETE ON auth.users TO authenticated;
GRANT INSERT, SELECT ON auth.users TO anon;
GRANT SELECT ON auth.users TO authenticator;
GRANT REFERENCES, SELECT ON TABLE auth.users TO service;

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
ON auth.users FOR SELECT TO anon
USING ( true );

CREATE POLICY "Anyone can create profiles"
ON auth.users FOR INSERT TO anon
WITH CHECK ( true );

CREATE POLICY "Users can update their own profiles."
ON auth.users FOR UPDATE TO authenticated
USING ( (SELECT auth.uid()) = user_id)
WITH CHECK ( (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their profiles."
ON auth.users FOR DELETE TO authenticated
USING ( (SELECT auth.uid()) = user_id);

CREATE TABLE auth.refresh_tokens(
    refresh_token uuid NOT NULL DEFAULT generate_uuidv7(),
    user_id uuid REFERENCES auth.users(user_id) NOT NULL,
    exp TIMESTAMPTZ NOT NULL DEFAULT now() + '30 days',
    PRIMARY KEY (refresh_token, exp)
) WITH (
    tsdb.hypertable,
    tsdb.segmentby = 'user_id',
    tsdb.columnstore = false,
    tsdb.partition_column = 'exp',
    tsdb.orderby = 'exp DESC',
    tsdb.create_default_indexes = false,
    tsdb.chunk_interval='1 day'
);

CREATE INDEX ON auth.refresh_tokens(user_id);

-- Clean up chunks that have expired refresh tokens
SELECT add_retention_policy('auth.refresh_tokens', INTERVAL '0 hours');

GRANT INSERT, SELECT, UPDATE, DELETE ON auth.refresh_tokens TO anon;

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Really no way around it. If your access token is expired, you
-- need to be able to refresh it.
CREATE POLICY "Anonymous users can view refresh tokens"
ON auth.refresh_tokens FOR SELECT TO anon
USING (true);

CREATE POLICY "Anyone can create refresh tokens for themselves"
ON auth.refresh_tokens FOR INSERT TO anon
WITH CHECK ( (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own refresh tokens."
ON auth.refresh_tokens FOR UPDATE TO anon
USING ( (SELECT auth.uid()) = user_id)
WITH CHECK ( (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their refresh tokens."
ON auth.refresh_tokens FOR DELETE TO anon
USING ( (SELECT auth.uid()) = user_id);
