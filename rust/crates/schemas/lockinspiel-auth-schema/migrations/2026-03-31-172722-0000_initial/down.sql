DROP POLICY "Users can delete their refresh tokens." ON auth.refresh_tokens;
DROP POLICY "Users can update their own refresh tokens." ON auth.refresh_tokens;
DROP POLICY "Anyone can create refresh tokens for themselves" ON auth.refresh_tokens;
DROP POLICY "Anonymous users can view refresh tokens" ON auth.refresh_tokens;

DROP TABLE auth.refresh_tokens;

DROP POLICY "Anyone can view profiles" ON auth.users;
DROP POLICY "Anyone can create profiles" ON auth.users;
DROP POLICY "Users can update their own profiles." ON auth.users;
DROP POLICY "Users can delete their profiles." ON auth.users;

DROP TABLE auth.users;
DROP FUNCTION auth.set_uid;
DROP FUNCTION auth.uid;
REVOKE USAGE ON SCHEMA auth FROM service;
