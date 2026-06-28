-- 005: Dangerous table-level operations

-- CASE 1: ALTER TABLE SET UNLOGGED — removes WAL protection; data LOST on crash
--         This is irreversible in terms of durability. MigraSafe MUST flag.
ALTER TABLE transactions SET UNLOGGED;

-- CASE 2: ALTER TABLE SET LOGGED — restores WAL protection; safe
--         MigraSafe must NOT flag this (it's the safe direction)
ALTER TABLE accounts SET LOGGED;

-- CASE 3: TRUNCATE with CASCADE — cascades to FK-referencing tables
--         More dangerous than regular TRUNCATE; must be flagged
TRUNCATE TABLE accounts CASCADE;

-- CASE 4: ALTER TABLE INHERIT — attaches table to inheritance hierarchy
--         Low impact, but changes schema contract; worth a note
ALTER TABLE accounts_archived INHERIT accounts;

-- CASE 5: COMMENT ON TABLE — metadata only, totally safe
COMMENT ON TABLE transactions IS 'Immutable ledger. Append-only by policy.';
