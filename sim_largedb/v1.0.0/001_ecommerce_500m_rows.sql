-- Simulasi: E-Commerce database besar ~500 juta row
-- Tabel orders: 500M rows, tabel order_items: 2 miliar rows
-- Semua operasi harus dianalisa untuk risiko downtime

-- ============================================================
-- SAFE: Operasi yang aman di database besar
-- ============================================================

-- Tambah kolom nullable (instant di semua versi PG)
ALTER TABLE orders ADD COLUMN fulfillment_center_id INT;
ALTER TABLE orders ADD COLUMN carrier_tracking_code TEXT;
ALTER TABLE order_items ADD COLUMN discount_reason TEXT;

-- Index CONCURRENTLY (tidak block, tapi lama ~beberapa jam di 500M rows)
CREATE INDEX CONCURRENTLY idx_orders_fulfillment
    ON orders(fulfillment_center_id)
    WHERE fulfillment_center_id IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_orders_carrier
    ON orders(carrier_tracking_code)
    WHERE carrier_tracking_code IS NOT NULL;

-- FK NOT VALID (tidak scan table — aman di table besar)
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_fulfillment
    FOREIGN KEY (fulfillment_center_id)
    REFERENCES fulfillment_centers(id) NOT VALID;

-- ============================================================
-- DANGER: Operasi berbahaya di database 500M rows
-- ============================================================

-- KRITIS: ADD COLUMN NOT NULL tanpa DEFAULT — akan GAGAL di table 500M rows
ALTER TABLE orders ADD COLUMN payment_gateway VARCHAR(50) NOT NULL;

-- KRITIS: ADD COLUMN volatile DEFAULT — table rewrite 500M rows = DOWNTIME BERJAM-JAM
ALTER TABLE orders ADD COLUMN idempotency_key UUID DEFAULT gen_random_uuid();
ALTER TABLE order_items ADD COLUMN line_item_id UUID DEFAULT gen_random_uuid();

-- KRITIS: ALTER COLUMN TYPE BIGINT — full table rewrite, 500M rows lock
ALTER TABLE orders ALTER COLUMN customer_id TYPE BIGINT;
ALTER TABLE order_items ALTER COLUMN order_id TYPE BIGINT;

-- KRITIS: ADD PRIMARY KEY — scan 500M rows di ACCESS EXCLUSIVE
ALTER TABLE orders ADD PRIMARY KEY (id);

-- KRITIS: ADD FOREIGN KEY tanpa NOT VALID — scan 2M rows
ALTER TABLE order_items
    ADD FOREIGN KEY (order_id) REFERENCES orders(id);

-- KRITIS: VACUUM FULL — rewrite 500M rows, database DOWN
VACUUM FULL orders;
VACUUM FULL order_items;

-- KRITIS: CLUSTER — rewrite 500M rows
CLUSTER orders USING idx_orders_created_at;

-- KRITIS: REINDEX TABLE (bukan CONCURRENTLY)
REINDEX TABLE orders;
REINDEX TABLE order_items;

-- KRITIS: REFRESH MATERIALIZED VIEW tanpa CONCURRENTLY
REFRESH MATERIALIZED VIEW order_daily_revenue_mv;
REFRESH MATERIALIZED VIEW product_sales_summary_mv;

-- KRITIS: DROP COLUMN — meski instant di PG12+, tetap irreversible
ALTER TABLE orders DROP COLUMN legacy_source;
ALTER TABLE order_items DROP COLUMN old_price_snapshot;

-- KRITIS: RENAME TABLE — breaks semua query, view, dan FK
ALTER TABLE orders RENAME TO sales_orders;

-- KRITIS: LOCK TABLE — blocking semua read/write di 500M row table
LOCK TABLE orders IN ACCESS EXCLUSIVE MODE;

-- KRITIS: SET lock_timeout = 0 pada database production besar
SET lock_timeout = 0;
SET statement_timeout = 0;

-- KRITIS: TRUNCATE di table besar
TRUNCATE TABLE orders_archive;

-- KRITIS: UPDATE tanpa WHERE di 500M rows
UPDATE orders SET is_synced = FALSE;

-- KRITIS: ALTER SYSTEM di database production besar
ALTER SYSTEM SET max_connections = 1000;
ALTER SYSTEM SET shared_buffers = '32GB';
