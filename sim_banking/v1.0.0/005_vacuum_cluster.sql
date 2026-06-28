-- VACUUM, CLUSTER, ANALYZE edge cases

-- VACUUM FULL — rewrites the entire table, exclusive lock
VACUUM FULL accounts;
VACUUM FULL transactions;

-- VACUUM (no FULL) — safe, should not flag
VACUUM accounts;
VACUUM ANALYZE transactions;

-- CLUSTER — rewrites table in index order, exclusive lock
CLUSTER accounts USING idx_accounts_user_id;
CLUSTER transactions;

-- ANALYZE — safe, should not flag
ANALYZE accounts;
ANALYZE;

-- VACUUM FULL ANALYZE (combined)
VACUUM FULL ANALYZE accounts;

-- REINDEX TABLE — rewrites all indexes, exclusive lock (HIGH)
REINDEX TABLE accounts;
REINDEX TABLE transactions;

-- REINDEX SCHEMA — broader scope (HIGH)
REINDEX SCHEMA public;

-- REINDEX DATABASE — even broader (HIGH)
REINDEX DATABASE banking_db;

-- REINDEX INDEX (single — MEDIUM)
REINDEX INDEX idx_accounts_user_id;
