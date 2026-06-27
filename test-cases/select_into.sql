SELECT id, email, created_at INTO TABLE users_archive FROM users WHERE created_at < '2020-01-01';
