-- Stress test: tricky safe patterns that often fool analyzers
-- Expected: ZERO warnings

-- Safe: VARCHAR to TEXT (catalog-only)
ALTER TABLE orders ALTER COLUMN note TYPE TEXT;

-- Safe: TEXT to CHARACTER VARYING (catalog-only)
ALTER TABLE orders ALTER COLUMN description TYPE CHARACTER VARYING;

-- Safe: SET DATA TYPE TEXT (catalog-only)
ALTER TABLE orders ALTER COLUMN ref SET DATA TYPE TEXT;

-- Safe: SET DATA TYPE CHARACTER VARYING (catalog-only)
ALTER TABLE orders ALTER COLUMN ref SET DATA TYPE CHARACTER VARYING;

-- Safe: varchar widening — VARCHAR(50) → VARCHAR(200) (no rewrite in PG)
ALTER TABLE orders ALTER COLUMN code TYPE VARCHAR(200);

-- Safe: DROP NOT NULL (always safe)
ALTER TABLE orders ALTER COLUMN note DROP NOT NULL;

-- Safe: SET DEFAULT (no scan)
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

-- Safe: DROP DEFAULT (no scan)
ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;

-- Safe: ADD COLUMN nullable, no DEFAULT
ALTER TABLE orders ADD COLUMN extra TEXT;

-- Safe: ADD COLUMN nullable, constant DEFAULT
ALTER TABLE orders ADD COLUMN priority INT DEFAULT 0;
ALTER TABLE orders ADD COLUMN is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN currency CHAR(3) DEFAULT 'USD';
ALTER TABLE orders ADD COLUMN metadata JSONB DEFAULT '{}';

-- Safe: cast constant DEFAULT (not volatile)
ALTER TABLE orders ADD COLUMN state VARCHAR(20) DEFAULT 'new'::VARCHAR;
ALTER TABLE orders ADD COLUMN score NUMERIC DEFAULT 0.0::NUMERIC;

-- Safe: FK NOT VALID (skip scan)
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) NOT VALID;

-- Safe: VALIDATE CONSTRAINT (ShareUpdateExclusiveLock only)
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_customer;

-- Safe: ADD CONSTRAINT PK USING INDEX
CREATE UNIQUE INDEX CONCURRENTLY idx_orders_pk ON orders(id);
ALTER TABLE orders ADD CONSTRAINT pk_orders PRIMARY KEY USING INDEX idx_orders_pk;

-- Safe: REINDEX INDEX CONCURRENTLY
REINDEX INDEX CONCURRENTLY idx_orders_pk;

-- Safe: DROP INDEX CONCURRENTLY
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_legacy;

-- Safe: CREATE INDEX CONCURRENTLY
CREATE INDEX CONCURRENTLY idx_orders_status ON orders(status);
CREATE UNIQUE INDEX CONCURRENTLY idx_orders_ref ON orders(ref) WHERE ref IS NOT NULL;

-- Safe: ANALYZE, VACUUM (no FULL)
ANALYZE orders;
VACUUM orders;

-- Safe: UPDATE with WHERE
UPDATE orders SET priority = 1 WHERE status = 'urgent';

-- Safe: DELETE with WHERE
DELETE FROM orders WHERE created_at < '2020-01-01' AND is_paid = TRUE;

-- Safe: 3-step NOT NULL workflow
ALTER TABLE orders ADD COLUMN source VARCHAR(50);
UPDATE orders SET source = 'web' WHERE source IS NULL;
ALTER TABLE orders ALTER COLUMN source SET NOT NULL;

-- Safe: REFRESH MATERIALIZED VIEW CONCURRENTLY
REFRESH MATERIALIZED VIEW CONCURRENTLY order_stats_mv;

-- Safe: CREATE TABLE, CREATE VIEW (no existing data affected)
CREATE TABLE order_snapshots (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT,
    snapped_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE VIEW pending_orders AS
    SELECT id, ref, status FROM orders WHERE status = 'pending';
