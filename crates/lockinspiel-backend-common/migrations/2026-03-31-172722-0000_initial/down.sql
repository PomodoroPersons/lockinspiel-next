-- DROP POLICY "Users can delete their own timesheet_tags." -- ON timesheet_tag;
-- DROP POLICY "Users can update their own timesheet_tags." -- ON timesheet_tag;
-- DROP POLICY "Public timesheet_tags are viewable only by authenticated users" -- ON timesheet_tag;
-- DROP POLICY "Users can create a timesheet_tag." -- ON timesheet_tag;

-- DROP VIEW timesheet_tag;

DROP TABLE timesheet_tag;

DROP POLICY "Users can delete their own tags." ON tag;
DROP POLICY "Users can update their own tags." ON tag;
DROP POLICY "Public tags are viewable only by authenticated users" ON tag;
DROP POLICY "Users can create a tag." ON tag;

DROP TABLE tag;
DROP SEQUENCE tag_pk;

-- DROP POLICY "Users can delete their own timesheets." -- ON timesheet;
-- DROP POLICY "Users can update their own timesheets." -- ON timesheet;
-- DROP POLICY "Public timesheets are viewable only by authenticated users" -- ON timesheet;
-- DROP POLICY "Users can create a timesheet." -- ON timesheet;

-- DROP VIEW timesheet;

DROP TABLE timesheet;

-- DROP POLICY "Users can delete their own timesheet_groups." -- ON timesheet_group;
-- DROP POLICY "Users can update their own timesheet_groups." -- ON timesheet_group;
-- DROP POLICY "Public timesheet_groups are viewable only by authenticated users" -- ON timesheet_group;
-- DROP POLICY "Users can create a timesheet_group." -- ON timesheet_group;

-- DROP VIEW timesheet_group;

DROP TABLE timesheet_group;

DROP POLICY "public can read time_split_timer" ON time_split_timer;

DROP TABLE time_split_timer;
DROP SEQUENCE time_split_timer_pk;

DROP POLICY "public can read time_split" ON time_split;

DROP TABLE time_split;
DROP SEQUENCE time_split_pk;

DROP POLICY "Users can delete their refresh tokens." ON refresh_tokens;
DROP POLICY "Users can update their own refresh tokens." ON refresh_tokens;
DROP POLICY "Anyone can create refresh tokens for themselves" ON refresh_tokens;
DROP POLICY "You can view your own refresh tokens" ON refresh_tokens;

DROP TABLE refresh_tokens;

DROP POLICY "Anyone can view profiles" ON users;
DROP POLICY "Anyone can create profiles" ON users;
DROP POLICY "Users can update their own profiles." ON users;
DROP POLICY "Users can delete their profiles." ON users;

DROP TABLE users;
DROP FUNCTION set_uid;
DROP FUNCTION uid;
