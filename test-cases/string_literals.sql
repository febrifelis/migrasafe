INSERT INTO audit_logs (action, query_text) VALUES ('user deleted', 'DROP TABLE was attempted');
INSERT INTO messages (body) VALUES ('Please TRUNCATE your response');
UPDATE settings SET value = 'DROP COLUMN not needed' WHERE key = 'hint';
