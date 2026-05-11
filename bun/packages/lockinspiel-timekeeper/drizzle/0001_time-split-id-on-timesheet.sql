ALTER TABLE IF EXISTS timekeeper.timesheet
    ADD COLUMN time_split_timer integer NOT NULL;
ALTER TABLE IF EXISTS timekeeper.timesheet
    ADD FOREIGN KEY (time_split_timer)
    REFERENCES timekeeper.time_split_timer (id);
