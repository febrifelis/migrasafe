-- 005: Index and view operations

-- CASE 1: CREATE INDEX without CONCURRENTLY — blocks all writes during build
--         Must be flagged
CREATE INDEX idx_members_role ON members (role);

-- CASE 2: CREATE UNIQUE INDEX without CONCURRENTLY — also blocks writes
--         Must be flagged
CREATE UNIQUE INDEX idx_members_ws_user ON members (workspace_id, user_id);

-- CASE 3: CREATE INDEX CONCURRENTLY — safe
--         Must NOT be flagged
CREATE INDEX CONCURRENTLY idx_members_accepted ON members (accepted_at)
    WHERE accepted_at IS NOT NULL;

-- CASE 4: CREATE OR REPLACE VIEW — can silently break callers if column list changes
--         Should be flagged (breaking change)
CREATE OR REPLACE VIEW active_members AS
    SELECT m.id, m.workspace_id, m.user_id, m.role
    FROM members m WHERE m.accepted_at IS NOT NULL;

-- CASE 5: DROP VIEW — destroys dependent queries/reports
--         Must be flagged
DROP VIEW IF EXISTS legacy_member_summary;

-- CASE 6: COMMENT ON INDEX — totally safe metadata op
COMMENT ON INDEX idx_members_ws IS 'Covers workspace-scoped member lookups.';
