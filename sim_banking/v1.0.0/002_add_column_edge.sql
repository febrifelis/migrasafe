-- ADD COLUMN edge cases targeting volatile DEFAULT and NOT NULL detection

-- Should flag: volatile DEFAULT (uuid_generate_v4 is a function call)
ALTER TABLE transactions ADD COLUMN external_ref UUID DEFAULT uuid_generate_v4();

-- Should flag: gen_random_uuid() volatile DEFAULT
ALTER TABLE accounts ADD COLUMN token UUID DEFAULT gen_random_uuid();

-- Should flag: CURRENT_TIMESTAMP (volatile pseudo-function, no parens)
ALTER TABLE accounts ADD COLUMN activated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Should flag: now() (volatile function)
ALTER TABLE transactions ADD COLUMN processed_at TIMESTAMPTZ DEFAULT now();

-- Should NOT flag: constant DEFAULT (no function)
ALTER TABLE accounts ADD COLUMN country_code CHAR(2) DEFAULT 'US';
ALTER TABLE accounts ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE accounts ADD COLUMN credit_limit NUMERIC(15,2) DEFAULT 0.00;

-- Should flag: NOT NULL without DEFAULT
ALTER TABLE transactions ADD COLUMN batch_id BIGINT NOT NULL;

-- Should NOT flag: NOT NULL WITH constant DEFAULT
ALTER TABLE accounts ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD';

-- Multi-clause: first clause safe, second clause has volatile DEFAULT
ALTER TABLE accounts
    ADD COLUMN display_name TEXT,
    ADD COLUMN session_token UUID DEFAULT gen_random_uuid();
