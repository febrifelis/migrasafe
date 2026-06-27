UPDATE users SET last_login = NOW() WHERE id = 1 RETURNING id, email;
