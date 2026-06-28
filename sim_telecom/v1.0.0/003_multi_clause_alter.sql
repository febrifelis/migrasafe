-- Multi-clause ALTER TABLE edge cases

-- Two DROP COLUMNs in one statement
ALTER TABLE call_records
    DROP COLUMN legacy_flag,
    DROP COLUMN deprecated_ref;

-- ADD COLUMN then DROP COLUMN in same statement
ALTER TABLE subscribers
    ADD COLUMN tmp_field TEXT,
    DROP COLUMN old_field;

-- Safe first clause, dangerous second clause: SET NOT NULL
ALTER TABLE subscribers
    ADD COLUMN status_code INT,
    ALTER COLUMN plan_id SET NOT NULL;

-- Both columns dangerous: NOT NULL without DEFAULT
ALTER TABLE call_records
    ADD COLUMN batch_id BIGINT NOT NULL,
    ADD COLUMN region_id INT NOT NULL;

-- Safe ADD COLUMN, then RENAME COLUMN
ALTER TABLE subscribers
    ADD COLUMN display_name TEXT,
    RENAME COLUMN msisdn TO phone_number;

-- ADD COLUMN volatile DEFAULT + ADD COLUMN NOT NULL without DEFAULT
ALTER TABLE call_records
    ADD COLUMN event_id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN cost_unit INT NOT NULL;
