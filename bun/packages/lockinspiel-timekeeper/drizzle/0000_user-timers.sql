GRANT USAGE ON SCHEMA timekeeper TO PUBLIC;

CREATE TABLE timekeeper.time_split(
    id SERIAL PRIMARY KEY,
    user_id uuid,
    name VARCHAR NOT NULL,
    description VARCHAR,
    deleted BOOLEAN NOT NULL DEFAULT false
);

GRANT INSERT, SELECT, UPDATE, DELETE ON timekeeper.time_split TO authenticated;
GRANT SELECT ON timekeeper.time_split TO anon;

-- ALTER TABLE timekeeper.time_split ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can create a time_split."
-- ON timekeeper.time_split FOR INSERT
-- TO authenticated
-- WITH CHECK ( auth.uid() = user_id );

-- CREATE POLICY "time_splits are viewable by anyone"
-- ON timekeeper.time_split FOR SELECT
-- TO anon
-- USING ( true );

-- CREATE POLICY "Users can update their own time_splits."
-- ON timekeeper.time_split FOR UPDATE
-- TO authenticated
-- USING ( auth.uid() = user_id )
-- WITH CHECK ( auth.uid() = user_id );

-- CREATE POLICY "Users can delete their own time_splits."
-- ON timekeeper.time_split FOR DELETE
-- TO authenticated
-- USING ( auth.uid() = user_id );

CREATE TABLE timekeeper.time_split_timer(
    id SERIAL PRIMARY KEY,
    order_idx INTEGER NOT NULL,
    time_split_id INTEGER NOT NULL REFERENCES timekeeper.time_split(id) ON DELETE CASCADE,
    len INTERVAL NOT NULL,
    name VARCHAR NOT NULL,
    work BOOLEAN NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT false
);

GRANT INSERT, SELECT, UPDATE, DELETE ON timekeeper.time_split_timer TO authenticated;
GRANT SELECT ON timekeeper.time_split_timer TO anon;

-- ALTER TABLE timekeeper.time_split_timer ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can create a time_split_timer."
-- ON timekeeper.time_split_timer FOR INSERT
-- TO authenticated
-- WITH CHECK (
--     EXISTS (
--         SELECT 1
--         FROM timekeeper.time_split
--         WHERE timekeeper.time_split.id = time_split_id
--         AND timekeeper.time_split.user_id = auth.uid()
--     )
-- );

-- CREATE POLICY "time_split_timers are viewable by anyone"
-- ON timekeeper.time_split_timer FOR SELECT
-- TO anon
-- USING ( true );

-- CREATE POLICY "Users can update their own time_split_timers."
-- ON timekeeper.time_split_timer FOR UPDATE
-- TO authenticated
-- USING (
--     EXISTS (
--         SELECT 1
--         FROM timekeeper.time_split
--         WHERE timekeeper.time_split.id = time_split_id
--         AND timekeeper.time_split.user_id = auth.uid()
--     )
-- )
-- WITH CHECK (
--     EXISTS (
--         SELECT 1
--         FROM timekeeper.time_split
--         WHERE timekeeper.time_split.id = time_split_id
--         AND timekeeper.time_split.user_id = auth.uid()
--     )
-- );

-- CREATE POLICY "Users can delete their own time_split_timers."
-- ON timekeeper.time_split_timer FOR DELETE
-- TO authenticated
-- USING (
--     EXISTS (
--         SELECT 1
--         FROM timekeeper.time_split
--         WHERE timekeeper.time_split.id = time_split_id
--         AND timekeeper.time_split.user_id = auth.uid()
--     )
-- );

CREATE TABLE timekeeper.timesheet(
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    user_id uuid NOT NULL,
    tags INTEGER[] NOT NULL DEFAULT '{}',
    time_split_timer INTEGER NOT NULL REFERENCES timekeeper.time_split_timer(id) ON DELETE CASCADE
) WITH (
    tsdb.hypertable,
    tsdb.segmentby = 'user_id',
    tsdb.partition_column = 'start_time',
    tsdb.orderby = 'start_time DESC',
    tsdb.create_default_indexes = false,
    tsdb.chunk_interval='7 days'
);

CREATE INDEX ON timekeeper.timesheet (user_id, start_time DESC);

GRANT INSERT, SELECT, UPDATE, DELETE ON timekeeper.timesheet TO authenticated;

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

CREATE SEQUENCE timekeeper.tag_pk;
CREATE TABLE timekeeper.tag(
    id INTEGER PRIMARY KEY DEFAULT nextval('timekeeper.tag_pk'),
    name VARCHAR NOT NULL UNIQUE,
    user_id uuid,
    deleted BOOLEAN NOT NULL DEFAULT false
);

GRANT INSERT, SELECT, UPDATE, DELETE ON timekeeper.tag TO authenticated;

-- ALTER TABLE timekeeper.tag ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can create a tag."
-- ON timekeeper.tag FOR INSERT
-- TO authenticated
-- WITH CHECK ( auth.uid() = user_id );

-- CREATE POLICY "Tags are viewable by anyone"
-- ON timekeeper.tag FOR SELECT
-- TO anon
-- USING ( true );

-- CREATE POLICY "Users can update their own tags."
-- ON timekeeper.tag FOR UPDATE
-- TO authenticated
-- USING ( auth.uid() = user_id )
-- WITH CHECK ( auth.uid() = user_id );

-- CREATE POLICY "Users can delete their own tags."
-- ON timekeeper.tag FOR DELETE
-- TO authenticated
-- USING ( auth.uid() = user_id );

INSERT INTO timekeeper.time_split (id, name) VALUES (0, '_paused_');
INSERT INTO timekeeper.time_split (name, description) VALUES
    ('Pomodoro', 'Classic, tried, and true'),
    ('Time Magazine', 'Based on studies'),
    ('Tyson Split', 'For those with extra dog in ''em'),
    ('Build Night', 'We burnin'' out tonight baby!');

INSERT INTO timekeeper.time_split_timer (time_split_id, order_idx, len, name, work) VALUES
    -- Pomodoro
    (1, 0, INTERVAL '25 minutes', 'Work', true),
    (1, 1, INTERVAL '5 minutes', 'Break', false),
    (1, 2, INTERVAL '25 minutes', 'Work', true),
    (1, 3, INTERVAL '15 minutes', 'Long Break', false),
    -- Time Magazine
    (2, 0, INTERVAL '52 minutes', 'Work', true),
    (2, 1, INTERVAL '17 minutes', 'Break', false),
    -- Tyson Split
    (3, 0, INTERVAL '90 minutes', 'Work', true),
    (3, 1, INTERVAL '10 minutes', 'Break', false),
    -- Build Night
    (4, 0, INTERVAL '120 minutes', 'Work', true),
    (4, 1, INTERVAL '10 minutes', 'Break', false);

