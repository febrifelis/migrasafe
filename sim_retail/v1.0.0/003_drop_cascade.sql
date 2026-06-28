-- DROP with CASCADE edge cases

-- DROP TABLE CASCADE (more dangerous than DROP TABLE alone)
DROP TABLE IF EXISTS legacy_products CASCADE;
DROP TABLE order_items CASCADE;

-- DROP SCHEMA CASCADE (destroys everything in schema)
DROP SCHEMA IF EXISTS staging CASCADE;

-- DROP TYPE CASCADE (breaks all columns using it)
DROP TYPE IF EXISTS product_status CASCADE;

-- DROP INDEX (without CONCURRENTLY, without IF EXISTS — dangerous)
DROP INDEX idx_old_products_name;

-- DROP INDEX with IF EXISTS (slightly safer)
DROP INDEX IF EXISTS idx_products_legacy_ref;

-- DROP SEQUENCE CASCADE
DROP SEQUENCE IF EXISTS old_product_id_seq CASCADE;

-- DROP VIEW (breaks dependents)
DROP VIEW IF EXISTS product_summary;

-- DROP MATERIALIZED VIEW
DROP MATERIALIZED VIEW product_stats_mv;

-- DROP FUNCTION with CASCADE
DROP FUNCTION IF EXISTS calculate_discount(NUMERIC, INT) CASCADE;

-- DROP DOMAIN CASCADE
DROP DOMAIN IF EXISTS money_positive CASCADE;

-- DROP AGGREGATE
DROP AGGREGATE IF EXISTS custom_avg(NUMERIC);

-- DROP OPERATOR (exotic but valid)
-- DROP OPERATOR IF EXISTS + (NUMERIC, NUMERIC);
