-- CTE, RETURNING, ON CONFLICT, and DML edge cases
-- Tests: UPDATE with WHERE (safe), UPDATE without WHERE (dangerous), DELETE patterns

-- Safe UPDATE (has WHERE)
UPDATE subscribers SET plan_id = 5 WHERE id = 1001;
UPDATE call_records SET status = 'processed' WHERE created_at < '2023-01-01';

-- Dangerous: UPDATE without WHERE
UPDATE subscribers SET notes = 'migrated';
UPDATE call_records SET legacy_flag = FALSE;

-- Safe DELETE (has WHERE)
DELETE FROM call_records WHERE created_at < '2020-01-01';

-- Dangerous: DELETE without WHERE
DELETE FROM tmp_staging_import;

-- INSERT with ON CONFLICT (upsert) — safe
INSERT INTO subscribers (msisdn, plan_id)
VALUES ('+1234567890', 1)
ON CONFLICT (msisdn) DO UPDATE SET plan_id = EXCLUDED.plan_id;

-- INSERT SELECT (bulk load — may need attention but not flagged currently)
INSERT INTO call_records_archive SELECT * FROM call_records WHERE created_at < '2022-01-01';

-- CTE UPDATE
WITH to_update AS (
    SELECT id FROM subscribers WHERE plan_id IS NULL
)
UPDATE subscribers SET plan_id = 1 WHERE id IN (SELECT id FROM to_update);

-- RETURNING clause (safe modifier)
UPDATE subscribers SET activated_at = NOW() WHERE id = 500 RETURNING id, activated_at;
