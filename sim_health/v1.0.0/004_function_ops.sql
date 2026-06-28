-- 004: Function and procedure operations

-- CASE 1: CREATE OR REPLACE FUNCTION — can silently break callers if signature changes
--         Must be flagged (similar to CREATE OR REPLACE VIEW)
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
    SELECT DATE_PART('year', AGE(birth_date))::INTEGER;
$$ LANGUAGE SQL STABLE;

-- CASE 2: DROP FUNCTION — removes function; callers will error at runtime
--         Must be flagged
DROP FUNCTION IF EXISTS legacy_patient_search(TEXT);

-- CASE 3: CREATE FUNCTION (no REPLACE) — safe, new function
--         Must NOT be flagged
CREATE FUNCTION get_patient_mrn(p_id BIGINT)
RETURNS VARCHAR AS $$
    SELECT mrn FROM patients WHERE id = p_id;
$$ LANGUAGE SQL STABLE;
