-- 002: Trigger operations

-- CASE 1: CREATE TRIGGER — safe (new object, no lock on data)
CREATE TRIGGER trg_content_updated
    BEFORE UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- CASE 2: DROP TRIGGER — removes enforcement logic; data integrity may be bypassed
--         Should be flagged (removes audit/validation logic)
DROP TRIGGER IF EXISTS trg_content_audit ON content_items;

-- CASE 3: ALTER TABLE DISABLE TRIGGER ALL — bypasses all triggers
--         Must be flagged (regression from Wave 6)
ALTER TABLE content_items DISABLE TRIGGER ALL;

-- CASE 4: ALTER TABLE ENABLE TRIGGER — restores trigger; safe
--         Must NOT be flagged (regression)
ALTER TABLE content_items ENABLE TRIGGER ALL;

-- CASE 5: DROP TRIGGER on a table that doesn't exist — IF EXISTS makes it safe
--         Still should flag — logic is gone regardless of whether it existed
DROP TRIGGER IF EXISTS trg_legacy_sync ON content_tags;
