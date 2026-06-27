BEGIN;
ALTER TABLE users ADD COLUMN verified BOOLEAN NOT NULL DEFAULT false;
UPDATE users SET verified = true WHERE created_at < '2024-01-01';
COMMIT;
