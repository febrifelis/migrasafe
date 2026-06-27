DELETE FROM sessions WHERE expired_at < NOW() RETURNING id;
