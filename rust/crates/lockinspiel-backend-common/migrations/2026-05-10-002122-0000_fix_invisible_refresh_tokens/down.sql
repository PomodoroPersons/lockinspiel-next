DROP POLICY "Anonymous users can view refresh tokens" ON refresh_tokens;

CREATE POLICY "You can view your own refresh tokens"
ON refresh_tokens FOR SELECT TO anon
USING ( (SELECT uid()) = user_id);
