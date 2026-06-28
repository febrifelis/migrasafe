-- TRUNCATE and LOCK TABLE edge cases
-- Tests: TRUNCATE with RESTART IDENTITY, LOCK TABLE variants, TRUNCATE CASCADE

-- TRUNCATE single table
TRUNCATE TABLE session_tokens;

-- TRUNCATE with RESTART IDENTITY — resets sequences too
TRUNCATE TABLE audit_logs RESTART IDENTITY;

-- TRUNCATE CASCADE — also truncates dependent tables
TRUNCATE TABLE orders CASCADE;

-- TRUNCATE multiple tables
TRUNCATE TABLE tmp_import_1, tmp_import_2, tmp_import_3;

-- LOCK TABLE explicit modes
LOCK TABLE orders IN ACCESS EXCLUSIVE MODE;
LOCK TABLE orders IN SHARE MODE;
LOCK TABLE orders IN ROW EXCLUSIVE MODE;
LOCK TABLE orders IN EXCLUSIVE MODE;

-- LOCK TABLE NOWAIT — should still flag but note NOWAIT means it won't block
LOCK TABLE payments IN ACCESS EXCLUSIVE MODE NOWAIT;

-- LOCK TABLE multiple tables
LOCK TABLE orders, payments, shipments IN ACCESS EXCLUSIVE MODE;
