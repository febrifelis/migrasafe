-- 003: User data operations — edge cases

-- CASE 1: UPDATE inside CTE — scoped, safe
WITH inactive AS (
    SELECT id FROM users WHERE last_login < NOW() - INTERVAL '2 years' AND status = 'active'
)
UPDATE users SET status = 'dormant' WHERE id IN (SELECT id FROM inactive);

-- CASE 2: DELETE with USING (PostgreSQL join-delete) — has WHERE, should be safe
DELETE FROM sessions s
USING users u
WHERE s.user_id = u.id AND u.status = 'banned' AND s.created_at < NOW() - INTERVAL '30 days';

-- CASE 3: TRUNCATE with RESTART IDENTITY — still wipes data, must be flagged
TRUNCATE TABLE email_verification_tokens RESTART IDENTITY;

-- CASE 4: DROP TABLE IF EXISTS — still dangerous, must be flagged
DROP TABLE IF EXISTS users_backup_2023;

-- CASE 5: Multiple tables TRUNCATE — must flag all
TRUNCATE TABLE password_reset_tokens, oauth_tokens, api_rate_limits;

-- CASE 6: UPDATE without WHERE — CRITICAL
UPDATE products SET updated_at = NOW();

-- CASE 7: DELETE without WHERE — CRITICAL
DELETE FROM product_views;
