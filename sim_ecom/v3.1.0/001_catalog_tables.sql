-- 001: Product catalog tables (safe — new tables)
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    parent_id   INTEGER REFERENCES categories(id),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    sku             VARCHAR(64) UNIQUE NOT NULL,
    category_id     INTEGER REFERENCES categories(id),
    name            VARCHAR(500) NOT NULL,
    description     TEXT,
    price_cents     BIGINT NOT NULL DEFAULT 0,
    stock_qty       INTEGER NOT NULL DEFAULT 0,
    weight_grams    INTEGER,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_images (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    alt_text    VARCHAR(255),
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    is_primary  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX CONCURRENTLY idx_products_category  ON products (category_id, active);
CREATE INDEX CONCURRENTLY idx_products_sku       ON products (sku);
CREATE INDEX CONCURRENTLY idx_product_images_pid ON product_images (product_id, sort_order);
