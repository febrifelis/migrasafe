-- Simulasi: Analytics Data Warehouse — tabel fact sangat besar
-- fact_events: 50 miliar rows, 200+ kolom
-- Operasi DDL di DWH sering menyebabkan downtime panjang

-- ============================================================
-- SAFE: Operasi aman di DWH
-- ============================================================

-- Tambah kolom analitik (nullable, constant default)
ALTER TABLE fact_events ADD COLUMN session_depth INT DEFAULT 0;
ALTER TABLE fact_events ADD COLUMN is_bot BOOLEAN DEFAULT FALSE;
ALTER TABLE fact_events ADD COLUMN geo_region VARCHAR(10);

-- Buat materialized view CONCURRENTLY untuk refresh inkremental
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_active_users_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY weekly_revenue_cohort_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_retention_mv;

-- REINDEX CONCURRENTLY untuk index yang bloat
REINDEX INDEX CONCURRENTLY idx_fact_events_user_id;
REINDEX INDEX CONCURRENTLY idx_fact_events_session;

-- ============================================================
-- DANGER: Operasi berbahaya di DWH 50 miliar rows
-- ============================================================

-- SANGAT BERBAHAYA: ALTER COLUMN TYPE di fact table 50B rows
-- Ini bisa memakan waktu BERHARI-HARI dengan lock aktif
ALTER TABLE fact_events ALTER COLUMN event_value TYPE NUMERIC(30,10);
ALTER TABLE fact_events ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE fact_events ALTER COLUMN timestamp_ms TYPE BIGINT USING (EXTRACT(EPOCH FROM ts) * 1000)::BIGINT;

-- BERBAHAYA: VACUUM FULL di 50B rows — mungkin butuh seminggu
VACUUM FULL fact_events;
VACUUM FULL fact_sessions;
VACUUM FULL dim_users;

-- BERBAHAYA: CLUSTER di 50B rows
CLUSTER fact_events USING idx_fact_events_ts;

-- BERBAHAYA: DROP COLUMN di 50B rows (irreversible)
ALTER TABLE fact_events DROP COLUMN deprecated_ab_variant;
ALTER TABLE fact_events DROP COLUMN old_campaign_ref;
ALTER TABLE fact_sessions DROP COLUMN legacy_partner_id;

-- BERBAHAYA: ADD COLUMN NOT NULL tanpa DEFAULT di 50B rows
ALTER TABLE fact_events ADD COLUMN pipeline_version SMALLINT NOT NULL;
ALTER TABLE fact_sessions ADD COLUMN ingest_node_id INT NOT NULL;

-- BERBAHAYA: ADD COLUMN volatile DEFAULT di 50B rows (rewrite!)
ALTER TABLE fact_events ADD COLUMN row_id UUID DEFAULT gen_random_uuid();
ALTER TABLE fact_sessions ADD COLUMN session_uuid UUID DEFAULT gen_random_uuid();

-- BERBAHAYA: REFRESH MATERIALIZED VIEW tanpa CONCURRENTLY — block reads
REFRESH MATERIALIZED VIEW daily_active_users_mv;
REFRESH MATERIALIZED VIEW product_funnel_mv;
REFRESH MATERIALIZED VIEW revenue_by_cohort_mv;

-- BERBAHAYA: DROP MATERIALIZED VIEW (breaks semua dashboard)
DROP MATERIALIZED VIEW IF EXISTS legacy_funnel_v1_mv;
DROP MATERIALIZED VIEW revenue_report_mv;

-- BERBAHAYA: DROP VIEW (breaks semua BI tool yang connect)
DROP VIEW IF EXISTS v_daily_summary;
DROP VIEW IF EXISTS v_cohort_analysis;

-- BERBAHAYA: RENAME COLUMN di 50B rows (breaks semua query BI)
ALTER TABLE fact_events RENAME COLUMN user_id TO visitor_id;
ALTER TABLE fact_events RENAME COLUMN ts TO event_timestamp;

-- BERBAHAYA: RENAME TABLE (breaks semua ETL pipeline)
ALTER TABLE fact_events RENAME TO fact_user_events;

-- BERBAHAYA: TRUNCATE di DWH (kehilangan semua historical data!)
TRUNCATE TABLE fact_events_staging;

-- BERBAHAYA: ALTER SYSTEM di production DWH
ALTER SYSTEM SET max_parallel_workers_per_gather = 16;
ALTER SYSTEM SET work_mem = '1GB';

-- BERBAHAYA: SET lock_timeout = 0 di lingkungan besar
SET lock_timeout = 0;
SET statement_timeout = 0;

-- BERBAHAYA: REINDEX DATABASE — semua index semua table
REINDEX DATABASE analytics_prod;
REINDEX SCHEMA public;

-- BERBAHAYA: ALTER TABLE SET TABLESPACE (pindah 50B rows ke storage baru)
ALTER TABLE fact_events SET TABLESPACE cold_storage;
ALTER TABLE fact_sessions SET TABLESPACE cold_storage;
