-- 003: Partitioning operations

-- CASE 1: CREATE TABLE with PARTITION BY — safe (new declarative partitioned table)
CREATE TABLE content_events (
    id          BIGSERIAL NOT NULL,
    content_id  BIGINT NOT NULL,
    event_type  VARCHAR(30) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

-- CASE 2: CREATE TABLE partition — safe (new child table)
CREATE TABLE content_events_2024
    PARTITION OF content_events
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- CASE 3: ATTACH PARTITION — acquires brief ACCESS EXCLUSIVE (metadata-only check)
--         Should flag (even brief ACCESS EXCLUSIVE blocks all traffic)
ALTER TABLE content_events ATTACH PARTITION content_events_2023
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

-- CASE 4: DETACH PARTITION CONCURRENTLY — safe in PG14+ (regression)
ALTER TABLE content_events DETACH PARTITION content_events_old CONCURRENTLY;

-- CASE 5: DETACH PARTITION (no CONCURRENTLY) — ACCESS EXCLUSIVE, must flag
ALTER TABLE content_events DETACH PARTITION content_events_2020;
