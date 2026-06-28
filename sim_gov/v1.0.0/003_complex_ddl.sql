-- Complex DDL: partitioned tables, inheritance, range types

-- CREATE TABLE with PARTITION BY (safe — no data yet)
CREATE TABLE audit_events (
    id BIGSERIAL,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    payload JSONB
) PARTITION BY RANGE (occurred_at);

-- CREATE TABLE as partition
CREATE TABLE audit_events_2024 PARTITION OF audit_events
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE audit_events_2025 PARTITION OF audit_events
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- ATTACH PARTITION (medium risk — brief ACCESS EXCLUSIVE)
ALTER TABLE audit_events ATTACH PARTITION audit_events_2023
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

-- DETACH PARTITION CONCURRENTLY (medium risk — non-blocking but routing change)
ALTER TABLE audit_events DETACH PARTITION audit_events_2022 CONCURRENTLY;

-- DETACH PARTITION without CONCURRENTLY (high risk — ACCESS EXCLUSIVE)
ALTER TABLE audit_events DETACH PARTITION audit_events_2021;

-- CREATE INDEX CONCURRENTLY on partition parent
CREATE INDEX CONCURRENTLY idx_audit_events_type ON audit_events(event_type);

-- ALTER TABLE ADD COLUMN on partitioned table
-- (propagates to all partitions — large op on production)
ALTER TABLE audit_events ADD COLUMN user_id BIGINT;

-- ADD COLUMN NOT NULL without DEFAULT on partitioned table
ALTER TABLE audit_events ADD COLUMN source_system TEXT NOT NULL;

-- DROP COLUMN on partitioned table
ALTER TABLE audit_events DROP COLUMN IF EXISTS deprecated_field;
