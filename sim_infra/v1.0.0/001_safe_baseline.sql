-- Infra migration: safe baseline (should produce zero warnings)
-- These are genuinely safe operations

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX CONCURRENTLY idx_audit_logs_created ON audit_logs(created_at);

-- Safe nullable ADD COLUMN with constant DEFAULT
ALTER TABLE audit_logs ADD COLUMN source TEXT DEFAULT 'system';
ALTER TABLE audit_logs ADD COLUMN severity INT DEFAULT 1;

-- DETACH PARTITION CONCURRENTLY (safe variant)
-- (skipped here as it needs existing partitioned table)

-- FK NOT VALID (safe variant)
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_event_type
    FOREIGN KEY (event_type) REFERENCES event_types(code) NOT VALID;

-- DROP INDEX CONCURRENTLY (safe variant)
DROP INDEX CONCURRENTLY IF EXISTS idx_old_audit;

-- VALIDATE CONSTRAINT (safe — ShareUpdateExclusiveLock only)
ALTER TABLE audit_logs VALIDATE CONSTRAINT fk_audit_event_type;
