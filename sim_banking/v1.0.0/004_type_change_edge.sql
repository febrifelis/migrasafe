-- ALTER COLUMN TYPE edge cases

-- VARCHAR → TEXT: should NOT flag (catalog-only in PG, no rewrite)
ALTER TABLE accounts ALTER COLUMN name TYPE TEXT;
ALTER TABLE transactions ALTER COLUMN description TYPE CHARACTER VARYING;

-- VARCHAR(100) → VARCHAR(200): widening varchar — should this flag?
-- In PG, VARCHAR(n) → VARCHAR(m) where m > n is catalog-only if no check constraint
ALTER TABLE accounts ALTER COLUMN email TYPE VARCHAR(500);

-- INT → BIGINT — requires full table rewrite, should flag HIGH
ALTER TABLE accounts ALTER COLUMN old_id TYPE BIGINT;

-- TEXT → JSONB with USING — should flag HIGH (explicit cast, rewrite)
ALTER TABLE accounts ALTER COLUMN metadata TYPE JSONB USING metadata::JSONB;

-- NUMERIC(10,2) → NUMERIC(15,4) — requires rewrite, should flag
ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(20,6);

-- SET DATA TYPE (alternative syntax for TYPE)
ALTER TABLE transactions ALTER COLUMN note SET DATA TYPE TEXT;

-- Safe: CHAR(2) stays CHAR(2) — no change, but still parsed as type change
-- (we expect this to be flagged unless we detect same-type no-ops)
ALTER TABLE accounts ALTER COLUMN country_code TYPE CHAR(3);
