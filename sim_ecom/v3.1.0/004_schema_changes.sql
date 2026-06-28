-- 004: Schema restructure — mixed safe/unsafe

-- CASE 1: CREATE OR REPLACE VIEW — breaking if column order changes
CREATE OR REPLACE VIEW order_summary AS
SELECT o.id, o.status, o.total_cents, u.email
FROM orders o JOIN users u ON u.id = o.user_id;

-- CASE 2: ALTER TABLE SET storage options — safe
ALTER TABLE products SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE order_items SET (autovacuum_vacuum_scale_factor = 0.005);

-- CASE 3: ADD FOREIGN KEY — acquires SHARE ROW EXCLUSIVE lock (not full rewrite)
ALTER TABLE order_items ADD CONSTRAINT fk_order
    FOREIGN KEY (order_id) REFERENCES orders(id) NOT VALID;

-- CASE 4: VALIDATE CONSTRAINT — scans table but only ShareUpdateExclusiveLock
ALTER TABLE order_items VALIDATE CONSTRAINT fk_order;

-- CASE 5: DROP EXTENSION with CASCADE — destroys all dependent objects
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- CASE 6: ALTER SEQUENCE with RESTART at suspicious value
ALTER SEQUENCE products_id_seq RESTART WITH 1;

-- CASE 7: COMMENT ON — totally safe, no lock
COMMENT ON TABLE products IS 'Master product catalog. Updated by catalog-service.';
COMMENT ON COLUMN products.price_cents IS 'Price in smallest currency unit (IDR sen / USD cents).';
