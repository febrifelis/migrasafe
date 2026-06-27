INSERT INTO logs (message) VALUES ("DROP TABLE attempted by user");
UPDATE config SET val = "TRUNCATE not allowed" WHERE key = 'policy';
