-- 004: REINDEX scope variants — severity should scale with blast radius

-- CASE 1: REINDEX INDEX CONCURRENTLY — non-blocking, must NOT flag
REINDEX INDEX CONCURRENTLY idx_txn_account;

-- CASE 2: REINDEX INDEX (no CONCURRENTLY) — single index, MEDIUM
REINDEX INDEX idx_txn_ref;

-- CASE 3: REINDEX TABLE — single table scope, MEDIUM
REINDEX TABLE transactions;

-- CASE 4: REINDEX DATABASE — entire database, HIGH
REINDEX DATABASE fintech_db;

-- CASE 5: REINDEX SCHEMA — entire schema, HIGH (tested in Wave 7, regression)
REINDEX SCHEMA public;
