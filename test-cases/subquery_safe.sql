SELECT * FROM migrations WHERE name NOT IN (SELECT name FROM applied_migrations);
INSERT INTO archive SELECT * FROM users WHERE status = 'deleted';
