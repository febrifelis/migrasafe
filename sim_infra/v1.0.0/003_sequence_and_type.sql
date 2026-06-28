-- Sequence and type operations
-- Tests: ALTER SEQUENCE, ALTER TYPE RENAME VALUE, DROP SEQUENCE, CREATE TYPE, DROP TYPE CASCADE

-- ALTER SEQUENCE RESTART — resets the counter, can cause PK conflicts if IDs are reused
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE payments_id_seq RESTART;

-- DROP SEQUENCE — breaks nextval() callers
DROP SEQUENCE IF EXISTS legacy_seq;
DROP SEQUENCE old_invoice_seq CASCADE;

-- ALTER TYPE ... ADD VALUE (enum) — not transactional in old PG
ALTER TYPE order_status ADD VALUE 'PENDING_REVIEW' AFTER 'PLACED';
ALTER TYPE payment_method ADD VALUE 'CRYPTO';

-- ALTER TYPE ... RENAME VALUE (PG 10+)
ALTER TYPE order_status RENAME VALUE 'PENDING' TO 'AWAITING';

-- ALTER TYPE ... RENAME (rename whole type)
ALTER TYPE legacy_status RENAME TO order_status_v2;

-- DROP TYPE CASCADE — destroys all columns/params using this type
DROP TYPE IF EXISTS old_address_type CASCADE;

-- CREATE TYPE (should be safe)
CREATE TYPE address AS (
    street TEXT,
    city TEXT,
    zip VARCHAR(10)
);
