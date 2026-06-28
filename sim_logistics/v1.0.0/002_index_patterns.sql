-- 002: Index patterns — regression + new edge cases

-- CASE 1: CREATE INDEX CONCURRENTLY with partial predicate — safe (regression)
CREATE INDEX CONCURRENTLY idx_ship_active
    ON shipments (status, shipped_at) WHERE status NOT IN ('delivered','cancelled');

-- CASE 2: CREATE INDEX without CONCURRENTLY on expression — must flag
CREATE INDEX idx_ship_tracking_lower ON shipments (LOWER(tracking_no));

-- CASE 3: DROP INDEX CONCURRENTLY — safe (regression from Wave 7)
DROP INDEX CONCURRENTLY IF EXISTS idx_ship_legacy_status;

-- CASE 4: DROP INDEX without CONCURRENTLY — must flag (holds ACCESS EXCLUSIVE)
DROP INDEX idx_ship_old_dest;

-- CASE 5: REINDEX INDEX CONCURRENTLY — safe (regression from Wave 8)
REINDEX INDEX CONCURRENTLY idx_seg_hub;

-- CASE 6: CREATE INDEX on expression with function — still not CONCURRENTLY → flag
CREATE INDEX idx_seg_hub_upper ON route_segments (UPPER(hub_code));
