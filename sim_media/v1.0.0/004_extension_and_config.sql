-- 004: Extension and config operations

-- CASE 1: CREATE EXTENSION — safe (installs new capabilities)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CASE 2: CREATE EXTENSION with SCHEMA — still safe
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- CASE 3: ALTER EXTENSION UPDATE — upgrades extension; may change function signatures
--         Should flag (breaking change risk)
ALTER EXTENSION pg_trgm UPDATE TO '1.6';

-- CASE 4: DROP EXTENSION CASCADE (regression from Wave 7)
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- CASE 5: ALTER SYSTEM SET — changes postgresql.conf globally (regression from prior waves)
ALTER SYSTEM SET max_connections = 200;

-- CASE 6: ALTER SYSTEM RESET — resets a GUC; safe
ALTER SYSTEM RESET max_connections;
