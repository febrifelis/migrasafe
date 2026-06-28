-- 003: Type system changes

-- CASE 1: ALTER TYPE ADD VALUE — cannot run inside a transaction block in PG < 12
--         Entire migration file may be wrapped in BEGIN/COMMIT by migration tools
--         Must be flagged with a note about transaction incompatibility
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'guest';

-- CASE 2: ALTER TYPE RENAME VALUE — safe in PG 10+ (catalog-only, no rewrite)
--         Must NOT be flagged
ALTER TYPE member_role RENAME VALUE 'viewer' TO 'reader';

-- CASE 3: DROP TYPE CASCADE — destroys all columns using this type
--         Must be flagged (data-loss risk)
DROP TYPE IF EXISTS legacy_status CASCADE;

-- CASE 4: ALTER TABLE ALTER COLUMN SET DEFAULT — safe (no rewrite, no lock)
--         Must NOT be flagged
ALTER TABLE members ALTER COLUMN role SET DEFAULT 'viewer';

-- CASE 5: ALTER TABLE ALTER COLUMN DROP DEFAULT — safe
--         Must NOT be flagged
ALTER TABLE members ALTER COLUMN region DROP DEFAULT;
