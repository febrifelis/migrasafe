-- Final wave: corner cases that previously caused bugs

-- CHARACTER VARYING (two-word type — was false positive in old versions)
ALTER TABLE employees ALTER COLUMN employee_code TYPE CHARACTER VARYING;

-- VARCHAR -> TEXT (catalog-only — must NOT flag)
ALTER TABLE employees ALTER COLUMN notes TYPE VARCHAR;
ALTER TABLE employees ALTER COLUMN notes TYPE TEXT;

-- SET DATA TYPE TEXT (must NOT flag — catalog-only)
ALTER TABLE employees ALTER COLUMN notes SET DATA TYPE TEXT;

-- SET DATA TYPE CHARACTER VARYING (must NOT flag)
ALTER TABLE employees ALTER COLUMN notes SET DATA TYPE CHARACTER VARYING;

-- SET DATA TYPE BIGINT (must flag — table rewrite)
ALTER TABLE employees ALTER COLUMN id SET DATA TYPE BIGINT;

-- ALTER SYSTEM RESET (must be MEDIUM, not CRITICAL)
ALTER SYSTEM RESET work_mem;
ALTER SYSTEM RESET ALL;

-- ALTER SYSTEM SET (must be CRITICAL)
ALTER SYSTEM SET work_mem = '512MB';

-- DETACH PARTITION CONCURRENTLY (must be MEDIUM)
ALTER TABLE payroll DETACH PARTITION payroll_old CONCURRENTLY;

-- DETACH PARTITION without CONCURRENTLY (must be HIGH)
ALTER TABLE payroll DETACH PARTITION payroll_2019;

-- ADD CONSTRAINT PRIMARY KEY USING INDEX (must NOT flag — safe promotion)
CREATE UNIQUE INDEX CONCURRENTLY idx_employees_new_pk ON employees(id);
ALTER TABLE employees ADD CONSTRAINT pk_emp PRIMARY KEY USING INDEX idx_employees_new_pk;

-- ADD CONSTRAINT FOREIGN KEY NOT VALID (must NOT flag)
ALTER TABLE employees
    ADD CONSTRAINT fk_emp_dept FOREIGN KEY (department_id)
    REFERENCES departments(id) NOT VALID;

-- REINDEX INDEX CONCURRENTLY (must NOT flag)
REINDEX INDEX CONCURRENTLY idx_employees_code;

-- DROP INDEX CONCURRENTLY (must NOT flag)
DROP INDEX CONCURRENTLY IF EXISTS idx_employees_old;

-- DROP AGGREGATE (must be MEDIUM only, not double-flagged)
DROP AGGREGATE IF EXISTS custom_median(NUMERIC);

-- RENAME_SCHEMA (must flag HIGH)
ALTER SCHEMA old_payroll RENAME TO payroll_deprecated;

-- RENAME_TYPE (must flag HIGH)
ALTER TYPE payroll_status RENAME TO payroll_state;

-- RENAME_TYPE_VALUE (must flag HIGH)
ALTER TYPE employee_status RENAME VALUE 'ACTIVE' TO 'EMPLOYED';

-- ALTER SEQUENCE CYCLE (must flag HIGH)
ALTER SEQUENCE employees_id_seq CYCLE;

-- ALTER TABLE SET TABLESPACE (must flag HIGH)
ALTER TABLE employees SET TABLESPACE premium_ssd;
