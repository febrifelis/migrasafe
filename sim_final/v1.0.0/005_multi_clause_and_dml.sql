-- Final wave: multi-clause ALTER and DML patterns

-- Multi-clause: first safe, second volatile DEFAULT
ALTER TABLE employees
    ADD COLUMN notes TEXT,
    ADD COLUMN session_id UUID DEFAULT gen_random_uuid();

-- Multi-clause: first safe, second NOT NULL without DEFAULT
ALTER TABLE employees
    ADD COLUMN display_name TEXT,
    ADD COLUMN badge_number INT NOT NULL;

-- Multi-clause: first volatile, second NOT NULL without DEFAULT
ALTER TABLE employees
    ADD COLUMN event_id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN cost_center VARCHAR(20) NOT NULL;

-- Multi-clause: DROP COLUMN in later clause
ALTER TABLE employees
    ADD COLUMN tmp_col TEXT,
    DROP COLUMN deprecated_field;

-- Multi-clause: two DROP COLUMNs
ALTER TABLE employees
    DROP COLUMN old_field1,
    DROP COLUMN old_field2;

-- Safe UPDATE with WHERE
UPDATE employees SET grade = 'A1' WHERE salary > 10000;
UPDATE employees SET is_active = FALSE WHERE hired_at < '2010-01-01';

-- Dangerous: UPDATE without WHERE
UPDATE employees SET last_login = NOW();

-- Safe DELETE with WHERE
DELETE FROM employees WHERE is_active = FALSE AND hired_at < '2015-01-01';

-- Dangerous: DELETE without WHERE
DELETE FROM tmp_salary_import;

-- INSERT ... SELECT (safe — no existing data modified)
INSERT INTO employees_archive SELECT * FROM employees WHERE hired_at < '2020-01-01';

-- Safe: 3-step NOT NULL workflow
ALTER TABLE employees ADD COLUMN country_code CHAR(3);
UPDATE employees SET country_code = 'IDN' WHERE country_code IS NULL;
ALTER TABLE employees ALTER COLUMN country_code SET NOT NULL;

-- Dangerous: SET NOT NULL without prior UPDATE
ALTER TABLE employees ALTER COLUMN manager_id SET NOT NULL;

-- LOCK TABLE variants
LOCK TABLE employees IN ACCESS EXCLUSIVE MODE;
LOCK TABLE employees IN SHARE MODE;
LOCK TABLE employees, departments IN ACCESS EXCLUSIVE MODE;
