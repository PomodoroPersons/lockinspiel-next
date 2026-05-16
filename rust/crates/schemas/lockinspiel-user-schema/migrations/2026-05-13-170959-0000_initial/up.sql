CREATE TABLE "user".users (
    user_id uuid PRIMARY KEY REFERENCES auth.users(user_id),
    display_name VARCHAR NOT NULL UNIQUE,
    bio VARCHAR,
    avatar_location JSONB,
    status VARCHAR
);

CREATE TABLE "user".socials (
    id SERIAL PRIMARY KEY NOT NULL,
    icon_location JSONB,
    name VARCHAR
);

CREATE TABLE "user".social_links (
    user_id uuid REFERENCES auth.users(user_id),
    social INTEGER REFERENCES "user".socials(id),
    link VARCHAR NOT NULL,
    PRIMARY KEY(user_id, social)
);

INSERT INTO "user".socials (icon_location, name) VALUES
    ('{"location":"user_service","path":"/static/github.svg"}', 'GitHub'),
    ('{"location":"user_service","path":"/static/x.svg"}', 'X'),
    ('{"location":"user_service","path":"/static/reddit.svg"}', 'Reddit');
