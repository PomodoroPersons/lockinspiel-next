GRANT USAGE ON SCHEMA "user" TO anon;

CREATE FUNCTION "user".uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_user_id', true)::uuid;
$$;

CREATE FUNCTION "user".set_uid(uid uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT set_config('app.current_user_id', uid::text, false);
$$;

CREATE TABLE "user".profiles (
    user_id uuid PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    bio VARCHAR NOT NULL,
    avatar_location JSONB,
    status VARCHAR
);

GRANT INSERT, SELECT, UPDATE, DELETE ON "user".profiles TO authenticated;
GRANT SELECT ON "user".profiles TO anon;

ALTER TABLE "user".profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user profiles"
ON "user".profiles FOR SELECT TO anon
USING ( true );

CREATE POLICY "Anyone can create user profiles for themselves"
ON "user".profiles FOR INSERT TO authenticated
WITH CHECK ( "user".uid() = user_id );

CREATE POLICY "Users can update their own user profiles."
ON "user".profiles FOR UPDATE TO authenticated
USING ( "user".uid() = user_id )
WITH CHECK ( "user".uid() = user_id );

CREATE POLICY "Users can delete their user profiles."
ON "user".profiles FOR DELETE TO authenticated
USING ( "user".uid() = user_id );

CREATE TABLE "user".socials (
    id SERIAL PRIMARY KEY NOT NULL,
    icon_location JSONB,
    name VARCHAR
);

GRANT SELECT ON "user".socials TO anon;

CREATE TABLE "user".social_links (
    user_id uuid REFERENCES "user".profiles(user_id) ON DELETE CASCADE,
    social INTEGER REFERENCES "user".socials(id),
    link VARCHAR NOT NULL,
    PRIMARY KEY(user_id, social)
);

GRANT INSERT, SELECT, UPDATE, DELETE ON "user".social_links TO authenticated;
GRANT SELECT ON "user".social_links TO anon;

ALTER TABLE "user".social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view social links"
ON "user".social_links FOR SELECT TO anon
USING ( true );

CREATE POLICY "Anyone can create social links for themselves"
ON "user".social_links FOR INSERT TO authenticated
WITH CHECK ( "user".uid() = user_id );

CREATE POLICY "Users can update their own social links."
ON "user".social_links FOR UPDATE TO authenticated
USING ( "user".uid() = user_id )
WITH CHECK ( "user".uid() = user_id );

CREATE POLICY "Users can delete their social links."
ON "user".social_links FOR DELETE TO authenticated
USING ( "user".uid() = user_id );

INSERT INTO "user".socials (icon_location, name) VALUES
    ('{"location":"user_service","path":"/static/github.svg"}', 'GitHub'),
    ('{"location":"user_service","path":"/static/x.svg"}', 'X'),
    ('{"location":"user_service","path":"/static/reddit.svg"}', 'Reddit');
