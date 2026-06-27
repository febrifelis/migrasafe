DELETE FROM sessions WHERE expired_at < NOW();
UPDATE users SET last_login = NOW() WHERE id = 1;
