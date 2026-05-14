CREATE TABLE "user".users (
    id uuid PRIMARY KEY REFERENCES auth.users(user_id),
    display_name VARCHAR NOT NULL UNIQUE,
    avatar_location VARCHAR,
    status VARCHAR
);

CREATE TABLE "user".socials (
    id SERIAL PRIMARY KEY NOT NULL,
    icon_location VARCHAR,
    name VARCHAR
);

CREATE TABLE "user".social_links (
    user_id uuid REFERENCES auth.users(user_id),
    social INTEGER REFERENCES "user".socials(id),
    link VARCHAR NOT NULL
);

INSERT INTO "user".socials (icon_location, name) VALUES
    ('{ user_service }/static/github.svg', 'GitHub'),
    ('{ user_service }/static/x.svg', 'X'),
    ('{ user_service }/static/reddit.svg', 'Reddit');
