DROP POLICY "You can view your own refresh tokens" ON refresh_tokens;

-- Really no way around it. If your access token is expired, you
-- need to be able to refresh it.
CREATE POLICY "Anonymous users can view refresh tokens"
ON refresh_tokens FOR SELECT TO anon
USING (true);
