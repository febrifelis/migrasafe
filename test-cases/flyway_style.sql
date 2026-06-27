-- Flyway migration V10__add_audit_columns.sql
ALTER TABLE users ADD COLUMN created_by VARCHAR(100);
ALTER TABLE users ADD COLUMN updated_by VARCHAR(100);
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX CONCURRENTLY idx_users_deleted_at ON users(deleted_at);
