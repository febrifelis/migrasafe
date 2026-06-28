-- Miscellaneous ALTER COLUMN edge cases

-- ALTER COLUMN DROP NOT NULL (safe — relaxes constraint)
ALTER TABLE products ALTER COLUMN sku DROP NOT NULL;
ALTER TABLE products ALTER COLUMN name DROP NOT NULL;

-- ALTER COLUMN SET NOT NULL with prior UPDATE (safe pattern — suppressed)
UPDATE products SET price = 0.00 WHERE price IS NULL;
ALTER TABLE products ALTER COLUMN price SET NOT NULL;

-- ALTER COLUMN SET NOT NULL without prior UPDATE (dangerous)
ALTER TABLE products ALTER COLUMN created_at SET NOT NULL;

-- ALTER COLUMN SET DEFAULT (safe — no scan)
ALTER TABLE orders ALTER COLUMN quantity SET DEFAULT 1;

-- ALTER COLUMN DROP DEFAULT (safe — no scan)
ALTER TABLE orders ALTER COLUMN quantity DROP DEFAULT;

-- ALTER COLUMN TYPE: widening INT → BIGINT (requires rewrite)
ALTER TABLE orders ALTER COLUMN id TYPE BIGINT;

-- ALTER COLUMN TYPE: INT → SMALLINT (narrowing, could fail if values too large)
ALTER TABLE orders ALTER COLUMN quantity TYPE SMALLINT;

-- ALTER COLUMN TYPE: NUMERIC precision increase
ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(20,4);

-- ALTER COLUMN TYPE: TEXT → VARCHAR (catalog-only → should NOT flag)
ALTER TABLE products ALTER COLUMN name TYPE VARCHAR(500);

-- ALTER COLUMN TYPE: VARCHAR → TEXT (catalog-only → should NOT flag)
ALTER TABLE products ALTER COLUMN sku TYPE TEXT;

-- USING clause (explicit cast, always a rewrite)
ALTER TABLE orders ALTER COLUMN status TYPE INT USING status::INT;
