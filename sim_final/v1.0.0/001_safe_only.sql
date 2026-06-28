-- Final wave: purely safe operations (expect zero warnings)

CREATE TABLE employees (
    id BIGSERIAL PRIMARY KEY,
    employee_code VARCHAR(20) NOT NULL,
    department_id INT,
    salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    hired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Safe indexes
CREATE UNIQUE INDEX CONCURRENTLY idx_employees_code ON employees(employee_code);
CREATE INDEX CONCURRENTLY idx_employees_dept ON employees(department_id);
CREATE INDEX CONCURRENTLY idx_employees_active ON employees(hired_at) WHERE is_active = TRUE;

-- Safe ADD COLUMN (nullable, constant default)
ALTER TABLE employees ADD COLUMN manager_id BIGINT;
ALTER TABLE employees ADD COLUMN grade CHAR(2) DEFAULT 'B1';
ALTER TABLE employees ADD COLUMN notes TEXT;

-- Safe FK NOT VALID
ALTER TABLE employees
    ADD CONSTRAINT fk_employees_dept
    FOREIGN KEY (department_id) REFERENCES departments(id) NOT VALID;

-- Safe VALIDATE
ALTER TABLE employees VALIDATE CONSTRAINT fk_employees_dept;

-- Safe: DROP DEFAULT / SET DEFAULT (no scan)
ALTER TABLE employees ALTER COLUMN grade SET DEFAULT 'A1';
ALTER TABLE employees ALTER COLUMN grade DROP DEFAULT;

-- Safe: DROP NOT NULL (relaxes constraint)
ALTER TABLE employees ALTER COLUMN salary DROP NOT NULL;

-- Safe: VARCHAR -> TEXT (catalog-only)
ALTER TABLE employees ALTER COLUMN employee_code TYPE TEXT;

-- Safe: TEXT -> CHARACTER VARYING (catalog-only)
ALTER TABLE employees ALTER COLUMN notes TYPE CHARACTER VARYING;

-- Safe: REINDEX CONCURRENTLY
REINDEX INDEX CONCURRENTLY idx_employees_code;

-- Safe: DROP INDEX CONCURRENTLY
DROP INDEX CONCURRENTLY IF EXISTS idx_employees_legacy;

-- Safe: ANALYZE / VACUUM (no FULL)
ANALYZE employees;
VACUUM employees;

-- Safe: ADD CONSTRAINT PRIMARY KEY USING INDEX (pre-built index promotion)
CREATE UNIQUE INDEX CONCURRENTLY idx_employees_pk ON employees(id);
ALTER TABLE employees ADD CONSTRAINT pk_employees PRIMARY KEY USING INDEX idx_employees_pk;

-- Safe: FK NOT VALID + VALIDATE (two-step pattern)
ALTER TABLE employees
    ADD CONSTRAINT fk_employees_manager
    FOREIGN KEY (manager_id) REFERENCES employees(id) NOT VALID;
ALTER TABLE employees VALIDATE CONSTRAINT fk_employees_manager;
