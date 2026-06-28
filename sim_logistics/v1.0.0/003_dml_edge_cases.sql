-- 003: DML edge cases

-- CASE 1: UPDATE with WHERE using subquery — has WHERE clause, must NOT flag
UPDATE shipments SET status = 'lost'
WHERE id IN (SELECT shipment_id FROM route_segments
             WHERE arrived_at < NOW() - INTERVAL '30 days'
             AND departed_at IS NULL);

-- CASE 2: DELETE with EXISTS subquery — has WHERE, must NOT flag
DELETE FROM route_segments
WHERE NOT EXISTS (SELECT 1 FROM shipments s WHERE s.id = route_segments.shipment_id);

-- CASE 3: UPDATE setting status with WHERE CASE — has WHERE, must NOT flag
UPDATE shipments SET delivered_at = NOW()
WHERE status = 'in_transit' AND shipped_at < NOW() - INTERVAL '60 days';

-- CASE 4: INSERT INTO ... SELECT — bulk insert, potentially slow but safe
--         Must NOT flag (no lock risk, new rows only)
INSERT INTO shipments (tracking_no, origin_city, dest_city, status)
SELECT 'MIGR-' || id, 'JAKARTA', 'SURABAYA', 'archived'
FROM legacy_shipments WHERE archived = true;

-- CASE 5: UPDATE with no WHERE — CRITICAL, must flag
UPDATE route_segments SET arrived_at = NOW();

-- CASE 6: DELETE using CTE but effectively no WHERE on target table
WITH all_old AS (SELECT id FROM route_segments)
DELETE FROM route_segments WHERE id IN (SELECT id FROM all_old);
