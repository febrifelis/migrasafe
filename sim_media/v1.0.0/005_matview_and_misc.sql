-- 005: Materialized views, GRANTs, and misc

-- CASE 1: CREATE MATERIALIZED VIEW — safe (new object, reads source)
CREATE MATERIALIZED VIEW content_stats_mv AS
    SELECT author_id, COUNT(*) AS total, SUM(word_count) AS total_words
    FROM content_items WHERE published = TRUE
    GROUP BY author_id;

-- CASE 2: REFRESH MATERIALIZED VIEW (non-concurrent, regression from Wave 8)
REFRESH MATERIALIZED VIEW content_stats_mv;

-- CASE 3: REFRESH MATERIALIZED VIEW CONCURRENTLY — safe (regression)
REFRESH MATERIALIZED VIEW CONCURRENTLY content_daily_mv;

-- CASE 4: DROP MATERIALIZED VIEW — destroys reporting object
--         Should flag HIGH (data and dependent objects lost)
DROP MATERIALIZED VIEW IF EXISTS legacy_author_stats_mv;

-- CASE 5: GRANT — safe metadata op, no data risk
GRANT SELECT ON content_items TO readonly_role;

-- CASE 6: REVOKE — safe metadata op
REVOKE INSERT, UPDATE ON content_items FROM legacy_api_role;

-- CASE 7: ANALYZE — safe (updates table statistics)
ANALYZE content_items;

-- CASE 8: VACUUM (no FULL) — safe online operation
VACUUM content_items;
