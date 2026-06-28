-- 002: Column changes — volatile DEFAULT edge cases

-- CASE 1: ADD COLUMN with CONSTANT DEFAULT + NOT NULL — safe in PG11+ (catalog-only)
--         MigraSafe must NOT flag this as a rewrite
ALTER TABLE accounts ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'standard';

-- CASE 2: ADD COLUMN with volatile DEFAULT + NULLABLE — still causes rewrite in PG<14
--         because existing rows get the volatile value materialized
--         MigraSafe MUST flag this
ALTER TABLE transactions ADD COLUMN idempotency_id UUID DEFAULT gen_random_uuid();

-- CASE 3: ADD COLUMN with volatile DEFAULT + NOT NULL — rewrite in PG<14
--         (already tested in Wave 7, regression check)
ALTER TABLE accounts ADD COLUMN external_ref UUID DEFAULT gen_random_uuid() NOT NULL;

-- CASE 4: ALTER COLUMN TYPE with USING clause — must flag HIGH regardless of target type
--         Even TEXT target with USING is a real rewrite
ALTER TABLE accounts ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- CASE 5: ADD COLUMN NOT NULL no DEFAULT — must flag (existing rows fail constraint)
ALTER TABLE transactions ADD COLUMN channel VARCHAR(32) NOT NULL;
