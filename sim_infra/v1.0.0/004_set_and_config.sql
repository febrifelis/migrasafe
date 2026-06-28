-- SET config and lock_timeout edge cases
-- Tests: SET lock_timeout, SET work_mem, SET log_min_duration_statement, RESET ALL

-- SET lock_timeout = 0 — disables lock timeout, risky in migrations
SET lock_timeout = 0;
SET lock_timeout TO 0;

-- SET lock_timeout with quoted string (sanitize() strips this — may miss)
SET lock_timeout = '0';

-- SET statement_timeout = 0 — disables query timeout
SET statement_timeout = 0;
SET statement_timeout TO 0;

-- SET idle_in_transaction_session_timeout = 0 — disables idle timeout
SET idle_in_transaction_session_timeout = 0;

-- Safe: nonzero timeouts
SET lock_timeout = 5000;
SET statement_timeout = 30000;

-- SET work_mem (performance tuning — not dangerous for data, but affects memory)
SET work_mem = '256MB';

-- SET enable_seqscan = off (query planner tweak — not risky)
SET enable_seqscan = off;

-- RESET ALL — resets all session parameters
RESET ALL;

-- RESET individual
RESET work_mem;
RESET statement_timeout;
