-- Final wave: risky DDL operations — all should be flagged

-- HIGH: ADD COLUMN volatile DEFAULT (uuid)
ALTER TABLE employees ADD COLUMN token UUID DEFAULT gen_random_uuid();

-- HIGH: ADD COLUMN volatile DEFAULT (now())
ALTER TABLE employees ADD COLUMN last_login TIMESTAMPTZ DEFAULT now();

-- HIGH: ADD COLUMN volatile DEFAULT (CURRENT_TIMESTAMP pseudofunction)
ALTER TABLE employees ADD COLUMN refreshed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- HIGH: ADD COLUMN NOT NULL without DEFAULT
ALTER TABLE employees ADD COLUMN tax_code VARCHAR(30) NOT NULL;

-- HIGH: ADD COLUMN GENERATED ALWAYS AS STORED
ALTER TABLE employees
    ADD COLUMN annual_salary NUMERIC(14,2)
    GENERATED ALWAYS AS (salary * 12) STORED;

-- HIGH: ALTER COLUMN TYPE (rewrite)
ALTER TABLE employees ALTER COLUMN id TYPE BIGINT;
ALTER TABLE employees ALTER COLUMN salary TYPE NUMERIC(20,6);

-- HIGH: ALTER COLUMN TYPE with USING
ALTER TABLE employees ALTER COLUMN grade TYPE INT USING grade::INT;

-- HIGH: SET NOT NULL (without prior UPDATE)
ALTER TABLE employees ALTER COLUMN manager_id SET NOT NULL;

-- HIGH: ADD PRIMARY KEY (no USING INDEX)
ALTER TABLE employees ADD PRIMARY KEY (id);

-- HIGH: ADD FOREIGN KEY (no NOT VALID)
ALTER TABLE employees ADD FOREIGN KEY (manager_id) REFERENCES employees(id);

-- HIGH: ADD UNIQUE
ALTER TABLE employees ADD UNIQUE (employee_code);

-- MEDIUM: ADD CHECK (no NOT VALID)
ALTER TABLE employees ADD CHECK (salary >= 0);

-- HIGH: RENAME TABLE
ALTER TABLE employees RENAME TO staff;

-- HIGH: RENAME COLUMN
ALTER TABLE employees RENAME COLUMN salary TO base_salary;

-- CRITICAL: DROP COLUMN
ALTER TABLE employees DROP COLUMN notes;

-- HIGH: VACUUM FULL
VACUUM FULL employees;

-- HIGH: CLUSTER
CLUSTER employees USING idx_employees_dept;

-- HIGH: REINDEX TABLE
REINDEX TABLE employees;

-- HIGH: REINDEX SCHEMA
REINDEX SCHEMA hr;

-- HIGH: REFRESH MATERIALIZED VIEW (no CONCURRENTLY)
REFRESH MATERIALIZED VIEW employee_summary_mv;

-- HIGH: SET UNLOGGED
ALTER TABLE employees SET UNLOGGED;

-- HIGH: LOCK TABLE
LOCK TABLE employees IN ACCESS EXCLUSIVE MODE;

-- HIGH: SET lock_timeout = 0
SET lock_timeout = 0;
SET lock_timeout TO 0;

-- HIGH: SET statement_timeout = 0
SET statement_timeout = 0;

-- HIGH: SET idle_in_transaction_session_timeout = 0
SET idle_in_transaction_session_timeout = 0;
