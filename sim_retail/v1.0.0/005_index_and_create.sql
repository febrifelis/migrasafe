-- Index and CREATE edge cases

-- CREATE INDEX without CONCURRENTLY (dangerous — blocks writes)
CREATE INDEX idx_products_name ON products(name);
CREATE UNIQUE INDEX idx_products_barcode ON products(barcode);

-- CREATE INDEX CONCURRENTLY (safe)
CREATE INDEX CONCURRENTLY idx_products_price ON products(price);

-- CREATE INDEX IF NOT EXISTS without CONCURRENTLY
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);

-- CREATE INDEX on expression (without CONCURRENTLY)
CREATE INDEX idx_products_lower_name ON products(lower(name));

-- CREATE UNIQUE INDEX CONCURRENTLY (safe)
CREATE UNIQUE INDEX CONCURRENTLY idx_orders_invoice ON orders(invoice_number);

-- CREATE MATERIALIZED VIEW (safe — no existing data affected)
CREATE MATERIALIZED VIEW product_revenue_mv AS
    SELECT product_id, SUM(quantity) as total_sold
    FROM order_items
    GROUP BY product_id;

-- CREATE TABLE AS SELECT (copies data — safe for new table, but can be slow)
CREATE TABLE products_archive AS SELECT * FROM products WHERE is_active = FALSE;

-- CREATE TABLE LIKE (safe)
CREATE TABLE products_staging (LIKE products INCLUDING ALL);

-- ALTER INDEX RENAME (should this flag? breaks queries using index name hints)
ALTER INDEX idx_old_products RENAME TO idx_products_legacy;

-- ALTER INDEX SET (statistics — safe)
ALTER INDEX idx_products_sku ALTER COLUMN 1 SET STATISTICS 500;
