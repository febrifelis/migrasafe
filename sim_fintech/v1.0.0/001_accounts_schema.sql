-- 001: Core fintech schema — safe (new tables)
CREATE TABLE accounts (
    id              BIGSERIAL PRIMARY KEY,
    owner_id        BIGINT NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'IDR',
    balance_cents   BIGINT NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT NOT NULL REFERENCES accounts(id),
    amount_cents    BIGINT NOT NULL,
    direction       CHAR(1) NOT NULL CHECK (direction IN ('D','C')),
    reference_no    VARCHAR(64) UNIQUE NOT NULL,
    memo            TEXT,
    posted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_txn_account  ON transactions (account_id, posted_at DESC);
CREATE INDEX CONCURRENTLY idx_txn_ref      ON transactions (reference_no);
CREATE INDEX CONCURRENTLY idx_acc_owner    ON accounts (owner_id, status);
