-- Banking migration: safe index operations (should produce zero warnings)
-- All indexes created CONCURRENTLY

CREATE INDEX CONCURRENTLY idx_accounts_user_id ON accounts(user_id);
CREATE INDEX CONCURRENTLY idx_transactions_account ON transactions(account_id);
CREATE INDEX CONCURRENTLY idx_transactions_created ON transactions(created_at DESC);
CREATE UNIQUE INDEX CONCURRENTLY idx_accounts_iban ON accounts(iban) WHERE iban IS NOT NULL;

-- REINDEX CONCURRENTLY (single index — MEDIUM scope, not HIGH)
REINDEX INDEX CONCURRENTLY idx_accounts_user_id;

-- Safe: ADD COLUMN nullable no DEFAULT
ALTER TABLE accounts ADD COLUMN last_reviewed_at TIMESTAMPTZ;

-- Safe: ADD COLUMN nullable with constant DEFAULT
ALTER TABLE accounts ADD COLUMN tier INT DEFAULT 1;

-- FK NOT VALID (safe variant — deferred scan)
ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) NOT VALID;
