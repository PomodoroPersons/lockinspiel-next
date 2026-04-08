CREATE FUNCTION uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_user_id', true)::uuid;
$$;

CREATE FUNCTION set_uid(uid uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT set_config('app.current_user_id', uid::text, false);
$$;

CREATE TABLE users(
    user_id uuid PRIMARY KEY DEFAULT uuidv7(),
    username VARCHAR NOT NULL UNIQUE,
    pbkdf2_iterations INTEGER NOT NULL,
    salt BYTEA NOT NULL,
    password BYTEA NOT NULL
);

GRANT INSERT, SELECT, UPDATE, DELETE ON users TO authenticated;
GRANT INSERT, SELECT ON users TO anon;
GRANT SELECT ON users TO authenticator;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
ON users FOR SELECT TO anon
USING ( true );

CREATE POLICY "Anyone can create profiles"
ON users FOR INSERT TO anon
WITH CHECK ( true );

CREATE POLICY "Users can update their own profiles."
ON users FOR UPDATE TO authenticated
USING ( (SELECT uid()) = user_id)
WITH CHECK ( (SELECT uid()) = user_id);

CREATE POLICY "Users can delete their profiles."
ON users FOR DELETE TO authenticated
USING ( (SELECT uid()) = user_id);

CREATE TABLE refresh_tokens(
    refresh_token uuid NOT NULL DEFAULT uuidv7(),
    user_id uuid REFERENCES users(user_id) NOT NULL,
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

CREATE INDEX ON refresh_tokens(user_id);

-- Clean up chunks that have expired refresh tokens
SELECT add_retention_policy('refresh_tokens', INTERVAL '0 hours');

GRANT INSERT, SELECT, UPDATE, DELETE ON refresh_tokens TO anon;

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "You can view your own refresh tokens"
ON refresh_tokens FOR SELECT TO anon
USING ( (SELECT uid()) = user_id);

CREATE POLICY "Anyone can create refresh tokens for themselves"
ON refresh_tokens FOR INSERT TO anon
WITH CHECK ( (SELECT uid()) = user_id);

CREATE POLICY "Users can update their own refresh tokens."
ON refresh_tokens FOR UPDATE TO anon
USING ( (SELECT uid()) = user_id)
WITH CHECK ( (SELECT uid()) = user_id);

CREATE POLICY "Users can delete their refresh tokens."
ON refresh_tokens FOR DELETE TO anon
USING ( (SELECT uid()) = user_id);

CREATE SEQUENCE time_split_pk;
CREATE TABLE time_split(
    id INTEGER PRIMARY KEY DEFAULT nextval('time_split_pk'),
    name VARCHAR NOT NULL,
    description VARCHAR,
    deleted BOOLEAN NOT NULL DEFAULT false
);

GRANT SELECT ON time_split TO authenticated;
GRANT SELECT ON time_split TO anon;

ALTER TABLE time_split ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read time_split"
ON time_split
FOR SELECT TO anon
USING (true);

CREATE SEQUENCE time_split_timer_pk;
CREATE TABLE time_split_timer(
    id INTEGER PRIMARY KEY DEFAULT nextval('time_split_timer_pk'),
    time_split_id INTEGER NOT NULL REFERENCES time_split(id),
    len INTERVAL NOT NULL,
    name VARCHAR NOT NULL,
    work BOOLEAN NOT NULL
);

GRANT SELECT ON time_split_timer TO authenticated;
GRANT SELECT ON time_split_timer TO anon;

ALTER TABLE time_split_timer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read time_split_timer"
ON time_split_timer
FOR SELECT TO anon
USING (true);

CREATE TABLE timesheet_group(
    id uuid DEFAULT uuidv7() NOT NULL PRIMARY KEY,
    time_split_id INTEGER NOT NULL REFERENCES time_split(id),
    user_id uuid REFERENCES users(user_id) NOT NULL
) WITH (
    tsdb.hypertable,
    tsdb.segmentby = 'user_id',
    tsdb.partition_column = 'id',
    tsdb.orderby = 'id DESC',
    tsdb.create_default_indexes = false,
    tsdb.chunk_interval='7 days'
);

CREATE INDEX ON timesheet_group (user_id, id DESC);

GRANT INSERT, SELECT, UPDATE, DELETE ON timesheet_group TO authenticated;

-- CREATE VIEW timesheet_group AS
-- SELECT
--   *
-- FROM
--   raw_timesheet_group_data
-- WHERE
--     user_id = uid()
-- WITH CHECK OPTION;

-- ALTER TABLE timesheet_group ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can create a timesheet_group."
-- ON timesheet_group FOR INSERT
-- TO authenticated
-- WITH CHECK ( (SELECT uid()) = user_id );

-- CREATE POLICY "Public timesheet_groups are viewable only by authenticated users"
-- ON timesheet_group FOR SELECT
-- TO authenticated
-- USING ( true );

-- CREATE POLICY "Users can update their own timesheet_groups."
-- ON timesheet_group FOR UPDATE
-- TO authenticated
-- USING ( (SELECT uid()) = user_id )
-- WITH CHECK ( (SELECT uid()) = user_id );

-- CREATE POLICY "Users can delete their own timesheet_groups."
-- ON timesheet_group FOR DELETE
-- TO authenticated
-- USING ( (SELECT uid()) = user_id );

CREATE TABLE timesheet(
    timesheet_group uuid NOT NULL, -- REFERENCES timesheet_group(id),
    start_time TIMESTAMPTZ NOT NULL PRIMARY KEY,
    end_time TIMESTAMPTZ NOT NULL,
    user_id uuid REFERENCES users(user_id) NOT NULL,
    work BOOLEAN NOT NULL,
    UNIQUE (start_time, end_time)
) WITH (
    tsdb.hypertable,
    tsdb.segmentby = 'user_id',
    tsdb.partition_column = 'start_time',
    tsdb.orderby = 'start_time DESC',
    tsdb.create_default_indexes = false,
    tsdb.chunk_interval='7 days'
);

CREATE INDEX ON timesheet (user_id, start_time DESC);

GRANT INSERT, SELECT, UPDATE, DELETE ON timesheet TO authenticated;

-- CREATE VIEW timesheet AS
-- SELECT
--   *
-- FROM
--   raw_timesheet_data
-- WHERE
--     user_id = uid()
-- WITH CHECK OPTION;

-- ALTER TABLE timesheet ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can create a timesheet."
-- ON timesheet FOR INSERT
-- TO authenticated
-- WITH CHECK ( (SELECT uid()) = user_id );

-- CREATE POLICY "Public timesheets are viewable only by authenticated users"
-- ON timesheet FOR SELECT
-- TO authenticated
-- USING ( true );

-- CREATE POLICY "Users can update their own timesheets."
-- ON timesheet FOR UPDATE
-- TO authenticated
-- USING ( (SELECT uid()) = user_id )
-- WITH CHECK ( (SELECT uid()) = user_id );

-- CREATE POLICY "Users can delete their own timesheets."
-- ON timesheet FOR DELETE
-- TO authenticated
-- USING ( (SELECT uid()) = user_id );

CREATE SEQUENCE tag_pk;
CREATE TABLE tag(
    id INTEGER PRIMARY KEY DEFAULT nextval('tag_pk'),
    name VARCHAR NOT NULL UNIQUE,
    user_id uuid REFERENCES users(user_id),
    deleted BOOLEAN NOT NULL DEFAULT false
);

GRANT INSERT, SELECT, UPDATE, DELETE ON tag TO authenticated;

ALTER TABLE tag ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create a tag."
ON tag FOR INSERT
TO authenticated
WITH CHECK ( (SELECT uid()) IS NULL OR (SELECT uid()) = user_id );

CREATE POLICY "Public tags are viewable only by authenticated users"
ON tag FOR SELECT
TO authenticated
USING ( true );

CREATE POLICY "Users can update their own tags."
ON tag FOR UPDATE
TO authenticated
USING ( (SELECT uid()) = user_id )
WITH CHECK ( (SELECT uid()) = user_id );

CREATE POLICY "Users can delete their own tags."
ON tag FOR DELETE
TO authenticated
USING ( (SELECT uid()) = user_id );

CREATE TABLE timesheet_tag(
    timesheet_group uuid NOT NULL, -- REFERENCES timesheet_group(id),
    tag_id INTEGER NOT NULL REFERENCES tag(id),
    user_id uuid NOT NULL REFERENCES users(user_id),
    PRIMARY KEY (timesheet_group, tag_id)
) WITH (
    tsdb.hypertable,
    tsdb.segmentby = 'user_id',
    tsdb.partition_column = 'timesheet_group',
    tsdb.orderby = 'timesheet_group DESC',
    tsdb.create_default_indexes = false,
    tsdb.chunk_interval='7 days'
);

CREATE INDEX ON timesheet_tag (user_id, timesheet_group DESC);

GRANT INSERT, SELECT, UPDATE, DELETE ON timesheet_tag TO authenticated;

-- CREATE VIEW timesheet_tag AS
-- SELECT
--   *
-- FROM
--   raw_timesheet_tag_data
-- WHERE
--   user_id = uid()
-- WITH CHECK OPTION;

-- ALTER TABLE timesheet_tag ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can create a timesheet_tag."
-- ON timesheet_tag FOR INSERT
-- TO authenticated
-- WITH CHECK ( (SELECT uid()) = user_id );

-- CREATE POLICY "Public timesheet_tags are viewable only by authenticated users"
-- ON timesheet_tag FOR SELECT
-- TO authenticated
-- USING ( true );

-- CREATE POLICY "Users can update their own timesheet_tags."
-- ON timesheet_tag FOR UPDATE
-- TO authenticated
-- USING ( (SELECT uid()) = user_id )
-- WITH CHECK ( (SELECT uid()) = user_id );

-- CREATE POLICY "Users can delete their own timesheet_tags."
-- ON timesheet_tag FOR DELETE
-- TO authenticated
-- USING ( (SELECT uid()) = user_id );

INSERT INTO time_split (id, name) VALUES (0, '_paused_');
INSERT INTO time_split (name, description) VALUES
    ('Pomodoro', 'Classic, tried, and true'),
    ('Time Magazine', 'Based on studies'),
    ('Tyson Split', 'For those with extra dog in ''em'),
    ('Build Night', 'We burnin'' out tonight baby!');

INSERT INTO time_split_timer (time_split_id, len, name, work) VALUES
    -- _paused_
    (0, INTERVAL '0 minutes', '_paused_', false),
    -- Pomodoro
    (1, INTERVAL '25 minutes', 'Work', true),
    (1, INTERVAL '5 minutes', 'Break', false),
    (1, INTERVAL '25 minutes', 'Work', true),
    (1, INTERVAL '15 minutes', 'Long Break', false),
    -- Time Magazine
    (2, INTERVAL '52 minutes', 'Work', true),
    (2, INTERVAL '17 minutes', 'Break', false),
    -- Tyson Split
    (3, INTERVAL '90 minutes', 'Work', true),
    (3, INTERVAL '10 minutes', 'Break', false),
    -- Build Night
    (4, INTERVAL '120 minutes', 'Work', true),
    (4, INTERVAL '10 minutes', 'Break', false);
