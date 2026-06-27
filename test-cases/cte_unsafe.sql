WITH active_users AS (
  SELECT id FROM users WHERE active = true
)
UPDATE user_stats SET count = (SELECT COUNT(*) FROM active_users);
