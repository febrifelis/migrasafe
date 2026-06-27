BEGIN;
INSERT INTO audit_log (event, created_at) VALUES ('migration_start', now());
SAVEPOINT before_data_change;
UPDATE config SET value = 'v2' WHERE key = 'schema_version';
RELEASE SAVEPOINT before_data_change;
COMMIT;
