CREATE TABLE new_feature_flags (id SERIAL PRIMARY KEY, name VARCHAR(100));
CREATE INDEX CONCURRENTLY idx_flags_name ON new_feature_flags(name);
ALTER TABLE users ADD COLUMN feature_flags JSONB;
DROP TABLE old_feature_flags;
