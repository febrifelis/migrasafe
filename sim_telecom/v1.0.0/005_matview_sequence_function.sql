-- Materialized view, sequence, and function edge cases

-- REFRESH MATERIALIZED VIEW CONCURRENTLY (safe — no exclusive lock)
REFRESH MATERIALIZED VIEW CONCURRENTLY call_stats_mv;

-- REFRESH MATERIALIZED VIEW without CONCURRENTLY (dangerous)
REFRESH MATERIALIZED VIEW daily_summary_mv;

-- CREATE OR REPLACE VIEW (safe, but can break callers if signature changes)
CREATE OR REPLACE VIEW active_subscribers AS
    SELECT id, msisdn, plan_id FROM subscribers WHERE activated_at IS NOT NULL;

-- DROP VIEW CASCADE
DROP VIEW IF EXISTS legacy_call_report CASCADE;

-- CREATE OR REPLACE FUNCTION (breaks callers if signature or return type changes)
CREATE OR REPLACE FUNCTION get_subscriber_count() RETURNS BIGINT AS $$
    SELECT COUNT(*) FROM subscribers;
$$ LANGUAGE sql;

-- DROP FUNCTION
DROP FUNCTION IF EXISTS old_billing_calc(INT, NUMERIC);

-- CREATE TRIGGER (safe)
CREATE TRIGGER trg_subscriber_audit
    AFTER INSERT OR UPDATE ON subscribers
    FOR EACH ROW EXECUTE FUNCTION log_changes();

-- ALTER SEQUENCE SET INCREMENT — changes behavior of nextval()
ALTER SEQUENCE subscribers_id_seq INCREMENT BY 2;

-- ALTER SEQUENCE CYCLE — allows wrap-around, potential PK conflicts
ALTER SEQUENCE call_records_id_seq CYCLE;
