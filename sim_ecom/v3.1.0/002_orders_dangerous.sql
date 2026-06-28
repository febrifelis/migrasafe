-- 002: Orders refactor — multiple dangerous operations
-- orders: 80M rows, order_items: 320M rows

-- CASE 1: VARCHAR→TEXT upgrade (should be catalog-only in PG, but does migrasafe flag it?)
ALTER TABLE orders ALTER COLUMN notes TYPE TEXT;

-- CASE 2: INT→BIGINT (actual table rewrite — should be flagged)
ALTER TABLE order_items ALTER COLUMN quantity TYPE BIGINT;

-- CASE 3: Adding volatile DEFAULT — gen_random_uuid() is volatile
ALTER TABLE orders ADD COLUMN idempotency_key UUID DEFAULT gen_random_uuid() NOT NULL;

-- CASE 4: DROP INDEX CONCURRENTLY — safe, should NOT be flagged
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_old_status;

-- CASE 5: DETACH PARTITION CONCURRENTLY — PG14+ safe, should not be flagged or lower severity
ALTER TABLE orders_partitioned DETACH PARTITION orders_2022 CONCURRENTLY;

-- CASE 6: multi-clause ALTER in one statement — DROP + ADD + RENAME
ALTER TABLE order_items
    DROP COLUMN legacy_discount,
    ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0;

-- CASE 7: CREATE UNIQUE INDEX CONCURRENTLY — safe
CREATE UNIQUE INDEX CONCURRENTLY idx_orders_idempotency ON orders (idempotency_key);
