-- Retail migration: purely safe operations (zero warnings expected)

-- Safe CREATE statements
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(100) NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INT
);

-- Safe CONCURRENTLY indexes
CREATE INDEX CONCURRENTLY idx_products_sku ON products(sku);
CREATE INDEX CONCURRENTLY idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX CONCURRENTLY idx_products_category ON products(price);

-- Safe: FK NOT VALID
ALTER TABLE product_categories
    ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id)
    REFERENCES product_categories(id) NOT VALID;

-- Safe: ADD COLUMN nullable with constant DEFAULT
ALTER TABLE products ADD COLUMN weight_grams INT DEFAULT 0;
ALTER TABLE products ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Safe: DROP NOT NULL (always safe — relaxes constraint, no scan)
ALTER TABLE products ALTER COLUMN weight_grams DROP NOT NULL;

-- Safe: SET DEFAULT (no scan)
ALTER TABLE products ALTER COLUMN is_active SET DEFAULT FALSE;

-- Safe: CREATE VIEW
CREATE VIEW active_products AS
    SELECT id, sku, name, price FROM products WHERE is_active = TRUE;

-- Safe: ANALYZE (no lock)
ANALYZE products;

-- Safe: VALIDATE CONSTRAINT
ALTER TABLE product_categories VALIDATE CONSTRAINT fk_parent;
