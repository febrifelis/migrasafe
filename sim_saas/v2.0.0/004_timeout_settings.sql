-- 004: Session parameter changes — timeout traps

-- CASE 1: SET statement_timeout = 0 — disables all query timeouts
--         A runaway migration query will hold locks forever
--         Must be flagged
SET statement_timeout = 0;

-- CASE 2: SET statement_timeout to a finite value — safe
--         Must NOT be flagged
SET statement_timeout = '30min';

-- CASE 3: SET idle_in_transaction_session_timeout = 0 — disables idle-in-transaction cleanup
--         A stalled connection holds locks forever; must be flagged
SET idle_in_transaction_session_timeout = 0;

-- CASE 4: SET work_mem — safe, just tuning
--         Must NOT be flagged
SET work_mem = '256MB';

-- CASE 5: SET LOCAL lock_timeout = '10s' — safe (positive finite value)
--         Must NOT be flagged
SET LOCAL lock_timeout = '10s';
