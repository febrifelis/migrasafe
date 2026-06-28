-- 003: Multi-clause ALTER TABLE — parser may only see the first clause

-- CASE 1: First clause safe, second clause has volatile DEFAULT + NOT NULL
--         MigraSafe must detect the second clause too
ALTER TABLE patients
    ADD COLUMN notes TEXT,
    ADD COLUMN external_id UUID NOT NULL DEFAULT gen_random_uuid();

-- CASE 2: First clause dangerous, second safe — both should be caught
ALTER TABLE encounters
    DROP COLUMN legacy_notes,
    ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'ehr';

-- CASE 3: Three clauses: safe + volatile DEFAULT + DROP COLUMN
ALTER TABLE patients
    ADD COLUMN region VARCHAR(10) NOT NULL DEFAULT 'ID',
    ADD COLUMN sync_id UUID NOT NULL DEFAULT gen_random_uuid(),
    DROP COLUMN birth_date;
