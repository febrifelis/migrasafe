CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE products ADD COLUMN description TEXT;

CREATE INDEX CONCURRENTLY idx_products_name ON products(name);
