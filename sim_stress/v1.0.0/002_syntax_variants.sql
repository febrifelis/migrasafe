-- Stress test: syntax variants — test parser robustness
-- Mix of dangerous and safe; verify each is classified correctly

-- DANGER: ALTER COLUMN TYPE — various type targets
ALTER TABLE orders ALTER COLUMN id TYPE BIGINT;             -- HIGH (rewrite)
ALTER TABLE orders ALTER COLUMN amount TYPE NUMERIC(20,4);  -- HIGH (rewrite)
ALTER TABLE orders ALTER COLUMN code TYPE CHAR(10);         -- HIGH (rewrite)
ALTER TABLE orders ALTER COLUMN note TYPE TEXT;             -- SAFE (catalog-only)
ALTER TABLE orders ALTER COLUMN note TYPE VARCHAR;          -- SAFE (catalog-only)
ALTER TABLE orders ALTER COLUMN note TYPE CHARACTER VARYING; -- SAFE (catalog-only)

-- DANGER: SET DATA TYPE variants
ALTER TABLE orders ALTER COLUMN id SET DATA TYPE BIGINT;             -- HIGH (rewrite)
ALTER TABLE orders ALTER COLUMN note SET DATA TYPE TEXT;             -- SAFE (catalog-only)
ALTER TABLE orders ALTER COLUMN note SET DATA TYPE CHARACTER VARYING; -- SAFE (catalog-only)

-- DANGER: ALTER COLUMN TYPE with USING (always HIGH regardless of type)
ALTER TABLE orders ALTER COLUMN note TYPE TEXT USING note::TEXT;     -- HIGH (explicit cast)
ALTER TABLE orders ALTER COLUMN id TYPE BIGINT USING id::BIGINT;    -- HIGH (explicit cast)

-- DANGER: ADD COLUMN volatile defaults
ALTER TABLE orders ADD COLUMN uid UUID DEFAULT gen_random_uuid();
ALTER TABLE orders ADD COLUMN ts TIMESTAMPTZ DEFAULT now();
ALTER TABLE orders ADD COLUMN ts2 TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE orders ADD COLUMN ts3 TIMESTAMPTZ DEFAULT CURRENT_DATE;
ALTER TABLE orders ADD COLUMN ts4 TIMESTAMPTZ DEFAULT CURRENT_TIME;
ALTER TABLE orders ADD COLUMN uid2 UUID DEFAULT uuid_generate_v4();
ALTER TABLE orders ADD COLUMN created TIMESTAMPTZ DEFAULT transaction_timestamp();
ALTER TABLE orders ADD COLUMN clk TIMESTAMPTZ DEFAULT clock_timestamp();

-- SAFE: constant defaults (various literals)
ALTER TABLE orders ADD COLUMN col1 INT DEFAULT 42;
ALTER TABLE orders ADD COLUMN col2 BOOLEAN DEFAULT TRUE;
ALTER TABLE orders ADD COLUMN col3 TEXT DEFAULT 'hello';
ALTER TABLE orders ADD COLUMN col4 NUMERIC DEFAULT 3.14;
ALTER TABLE orders ADD COLUMN col5 TIMESTAMPTZ DEFAULT '2024-01-01';

-- DANGER: NOT NULL without DEFAULT
ALTER TABLE orders ADD COLUMN required_field BIGINT NOT NULL;
ALTER TABLE orders ADD COLUMN another_req TEXT NOT NULL;

-- SAFE: NOT NULL WITH constant DEFAULT
ALTER TABLE orders ADD COLUMN flag BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN level INT NOT NULL DEFAULT 0;
