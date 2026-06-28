-- 003: Materialized view operations

-- CASE 1: REFRESH MATERIALIZED VIEW without CONCURRENTLY — ACCESS EXCLUSIVE lock
--         blocks ALL reads and writes; MigraSafe MUST flag this
REFRESH MATERIALIZED VIEW account_balances_mv;

-- CASE 2: REFRESH MATERIALIZED VIEW CONCURRENTLY — only needs a UNIQUE index
--         acquires ShareUpdateExclusiveLock (doesn't block reads/writes)
--         MigraSafe must NOT flag this (or at INFO/safe level)
REFRESH MATERIALIZED VIEW CONCURRENTLY account_daily_summary_mv;

-- CASE 3: DROP MATERIALIZED VIEW — destroys data
DROP MATERIALIZED VIEW IF EXISTS legacy_report_mv;
