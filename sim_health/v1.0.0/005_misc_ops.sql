-- 005: Miscellaneous edge cases

-- CASE 1: CREATE TABLE AS SELECT — creates new table from query result
--         Acquires lock on source tables; can be slow on large datasets
--         Must be flagged (blocks source tables for the duration)
CREATE TABLE patients_archive AS
    SELECT * FROM patients WHERE created_at < NOW() - INTERVAL '5 years';

-- CASE 2: UPDATE with RETURNING but no WHERE — still a full-table update
--         Must be flagged as CRITICAL (no WHERE = all rows)
UPDATE encounters SET updated_at = NOW() RETURNING id;

-- CASE 3: TRUNCATE ONLY — truncates parent table only, not child partitions
--         Still wipes all data in parent; must be flagged
TRUNCATE ONLY patients_staging;

-- CASE 4: ALTER TABLE ATTACH PARTITION — briefly takes ACCESS EXCLUSIVE
--         Metadata-only but still potentially risky; should flag or note
ALTER TABLE encounters_partitioned ATTACH PARTITION encounters_2024
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- CASE 5: DELETE without WHERE using alias — must be flagged (all rows)
DELETE FROM encounters e;
