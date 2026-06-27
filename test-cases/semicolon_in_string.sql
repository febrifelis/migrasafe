INSERT INTO queries (sql_text) VALUES ('DROP TABLE users; TRUNCATE orders;');
UPDATE config SET query = 'DELETE FROM logs; UPDATE users SET x=1;' WHERE id = 1;
