-- Constraint edge cases

-- ADD PRIMARY KEY — should flag HIGH
ALTER TABLE accounts ADD PRIMARY KEY (id);

-- ADD FOREIGN KEY (without CONSTRAINT keyword) — should flag HIGH
ALTER TABLE transactions ADD FOREIGN KEY (account_id) REFERENCES accounts(id);

-- ADD FOREIGN KEY NOT VALID — should NOT flag (deferred scan)
ALTER TABLE transactions
    ADD FOREIGN KEY (currency_id) REFERENCES currencies(id) NOT VALID;

-- ADD UNIQUE — currently returns [] from visitor — check behavior
ALTER TABLE accounts ADD UNIQUE (iban);

-- ADD CHECK — check behavior
ALTER TABLE transactions ADD CHECK (amount > 0);

-- ADD CONSTRAINT UNIQUE with name
ALTER TABLE accounts ADD CONSTRAINT uq_accounts_iban UNIQUE (iban);

-- ADD CONSTRAINT CHECK with name
ALTER TABLE transactions ADD CONSTRAINT chk_positive_amount CHECK (amount > 0);

-- ADD CONSTRAINT PRIMARY KEY with USING INDEX
ALTER TABLE accounts
    ADD CONSTRAINT pk_accounts PRIMARY KEY USING INDEX idx_accounts_pk;

-- DROP CONSTRAINT (MEDIUM expected)
ALTER TABLE transactions DROP CONSTRAINT fk_old_account;

-- VALIDATE CONSTRAINT (should be safe — ShareUpdateExclusiveLock)
ALTER TABLE transactions VALIDATE CONSTRAINT fk_transactions_account;
