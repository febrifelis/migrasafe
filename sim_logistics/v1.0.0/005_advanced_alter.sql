-- 005: Advanced ALTER TABLE patterns

-- CASE 1: ADD COLUMN with GENERATED ALWAYS AS (stored) — requires table rewrite in PG
--         must flag (rewrites for all existing rows)
ALTER TABLE shipments ADD COLUMN total_days INTEGER
    GENERATED ALWAYS AS (EXTRACT(DAY FROM (delivered_at - shipped_at))::INTEGER) STORED;

-- CASE 2: ALTER COLUMN SET STATISTICS — safe (no lock, no rewrite)
ALTER TABLE shipments ALTER COLUMN status SET STATISTICS 500;

-- CASE 3: ADD COLUMN with array DEFAULT — constant array, NOT volatile
--         must NOT flag (e.g. DEFAULT '{}'::text[])
ALTER TABLE shipments ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

-- CASE 4: ALTER COLUMN TYPE using USING with arithmetic — must flag (table rewrite)
ALTER TABLE shipments ALTER COLUMN weight_kg TYPE BIGINT
    USING (weight_kg * 1000)::BIGINT;

-- CASE 5: SET DEFAULT on existing column with volatile fn — safe (no rewrite)
--         Changing DEFAULT doesn't rewrite; only affects new rows
--         Must NOT flag
ALTER TABLE route_segments ALTER COLUMN arrived_at SET DEFAULT NOW();

-- CASE 6: ADD COLUMN with CHECK inline constraint — triggers table scan
ALTER TABLE shipments ADD COLUMN priority SMALLINT NOT NULL DEFAULT 5
    CHECK (priority BETWEEN 1 AND 10);
