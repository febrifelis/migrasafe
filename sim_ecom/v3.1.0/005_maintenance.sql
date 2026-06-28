-- 005: Maintenance ops — mixed

-- CASE 1: CLUSTER on large table (full rewrite)
CLUSTER order_items USING idx_order_items_order_id;

-- CASE 2: REINDEX SCHEMA — blocks entire schema
REINDEX SCHEMA ecom;

-- CASE 3: ALTER TABLE DISABLE TRIGGER ALL — disables ALL triggers
ALTER TABLE orders DISABLE TRIGGER ALL;

-- CASE 4: ALTER TABLE ENABLE TRIGGER — safe, just re-enables
ALTER TABLE orders ENABLE TRIGGER ALL;

-- CASE 5: LOCK TABLE with NOWAIT — should still be flagged
LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE NOWAIT;

-- CASE 6: SET lock_timeout = 0 then safe DDL
SET lock_timeout = 0;
ALTER TABLE products ADD COLUMN search_vector TSVECTOR;
CREATE INDEX CONCURRENTLY idx_products_search ON products USING gin(search_vector);

-- CASE 7: ALTER TYPE RENAME VALUE — safe in PG 10+
ALTER TYPE order_status RENAME VALUE 'pending' TO 'awaiting_payment';
