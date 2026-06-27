BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
COMMIT;
