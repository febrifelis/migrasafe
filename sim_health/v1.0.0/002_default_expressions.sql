-- 002: DEFAULT expression edge cases — tests volatile-detection accuracy

-- CASE 1: Constant expression in parentheses — NOT volatile (must NOT flag)
--         Parens alone do NOT indicate a function call
ALTER TABLE patients ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT (TRUE);

-- CASE 2: Numeric constant in parens — NOT volatile (must NOT flag)
ALTER TABLE patients ADD COLUMN priority INTEGER NOT NULL DEFAULT (0);

-- CASE 3: Volatile DEFAULT without parens (keyword form) — IS volatile (must flag)
--         CURRENT_TIMESTAMP is non-deterministic; PG < 14 rewrites for existing rows
ALTER TABLE encounters ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CASE 4: Volatile function in parens — IS volatile (must flag)
ALTER TABLE encounters ADD COLUMN trace_id UUID DEFAULT (gen_random_uuid());

-- CASE 5: Constant string cast — NOT volatile (must NOT flag)
ALTER TABLE patients ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ('active'::VARCHAR);

-- CASE 6: NOW() — volatile (must flag, regression check from Wave 8)
ALTER TABLE patients ADD COLUMN last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW();
