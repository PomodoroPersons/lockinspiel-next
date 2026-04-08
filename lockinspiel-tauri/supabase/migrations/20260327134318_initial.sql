CREATE SEQUENCE time_split_pk;
CREATE TABLE time_split(
    id INTEGER PRIMARY KEY DEFAULT nextval('time_split_pk'),
    name VARCHAR NOT NULL,
    description VARCHAR,
    deleted BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE time_split ENABLE ROW LEVEL SECURITY;

create policy "public can read time_split"
on time_split
for select to anon
using (true);

CREATE SEQUENCE time_split_timer_pk;
CREATE TABLE time_split_timer(
    id INTEGER PRIMARY KEY DEFAULT nextval('time_split_timer_pk'),
    time_split_id INTEGER NOT NULL REFERENCES time_split(id),
    len INTERVAL NOT NULL,
    name VARCHAR NOT NULL,
    work BOOLEAN NOT NULL
);

ALTER TABLE time_split_timer ENABLE ROW LEVEL SECURITY;

create policy "public can read time_split_timer"
on time_split_timer
for select to anon
using (true);

CREATE SEQUENCE timesheet_group_pk;
CREATE TABLE timesheet_group(
    timesheet_group BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('timesheet_group_pk'),
    time_split_id INTEGER NOT NULL REFERENCES time_split(id),
    user_id uuid REFERENCES auth.users NOT NULL
);

ALTER TABLE timesheet_group ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create a timesheet_group."
ON timesheet_group FOR INSERT
TO authenticated
WITH CHECK ( (SELECT auth.uid()) = user_id );

CREATE POLICY "Public timesheet_groups are viewable only by authenticated users"
ON timesheet_group FOR SELECT
TO authenticated
USING ( true );

CREATE POLICY "Users can update their own timesheet_groups."
ON timesheet_group FOR UPDATE
TO authenticated
USING ( (SELECT auth.uid()) = user_id )
WITH CHECK ( (SELECT auth.uid()) = user_id );

CREATE policy "Users can delete their own timesheet_groups."
ON timesheet_group FOR DELETE
TO authenticated
USING ( (SELECT auth.uid()) = user_id );

CREATE TABLE timesheet(
    timesheet_group BIGINT NOT NULL REFERENCES timesheet_group(timesheet_group),
    start_time TIMESTAMP NOT NULL PRIMARY KEY,
    end_time TIMESTAMP NOT NULL UNIQUE,
    user_id uuid REFERENCES auth.users NOT NULL,
    work BOOLEAN NOT NULL
);

ALTER TABLE timesheet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create a timesheet."
ON timesheet FOR INSERT
TO authenticated
WITH CHECK ( (SELECT auth.uid()) = user_id );

CREATE POLICY "Public timesheets are viewable only by authenticated users"
ON timesheet FOR SELECT
TO authenticated
USING ( true );

CREATE POLICY "Users can update their own timesheets."
ON timesheet FOR UPDATE
TO authenticated
USING ( (SELECT auth.uid()) = user_id )
WITH CHECK ( (SELECT auth.uid()) = user_id );

CREATE policy "Users can delete their own timesheets."
ON timesheet FOR DELETE
TO authenticated
USING ( (SELECT auth.uid()) = user_id );

CREATE SEQUENCE tag_pk;
CREATE TABLE tag(
    id INTEGER PRIMARY KEY DEFAULT nextval('tag_pk'),
    tag VARCHAR NOT NULL UNIQUE,
    user_id uuid REFERENCES auth.users,
    deleted BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE tag ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create a tag."
ON tag FOR INSERT
TO authenticated
WITH CHECK ( (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) = user_id );

CREATE POLICY "Public tags are viewable only by authenticated users"
ON tag FOR SELECT
TO authenticated
USING ( true );

CREATE POLICY "Users can update their own tags."
ON tag FOR UPDATE
TO authenticated
USING ( (SELECT auth.uid()) = user_id )
WITH CHECK ( (SELECT auth.uid()) = user_id );

CREATE policy "Users can delete their own tags."
ON tag FOR DELETE
TO authenticated
USING ( (SELECT auth.uid()) = user_id );

CREATE TABLE timesheet_tag(
    timesheet_group BIGINT NOT NULL REFERENCES timesheet_group(timesheet_group),
    tag_id INTEGER NOT NULL REFERENCES tag(id),
    user_id uuid REFERENCES auth.users,
    PRIMARY KEY (timesheet_group, tag_id)
);

ALTER TABLE timesheet_tag ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create a timesheet_tag."
ON timesheet_tag FOR INSERT
TO authenticated
WITH CHECK ( (SELECT auth.uid()) = user_id );

CREATE POLICY "Public timesheet_tags are viewable only by authenticated users"
ON timesheet_tag FOR SELECT
TO authenticated
USING ( true );

CREATE POLICY "Users can update their own timesheet_tags."
ON timesheet_tag FOR UPDATE
TO authenticated
USING ( (SELECT auth.uid()) = user_id )
WITH CHECK ( (SELECT auth.uid()) = user_id );

CREATE policy "Users can delete their own timesheet_tags."
ON timesheet_tag FOR DELETE
TO authenticated
USING ( (SELECT auth.uid()) = user_id );

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
