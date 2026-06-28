-- 002: Constraint operations — FK, PK, UNIQUE edge cases

-- CASE 1: ADD PRIMARY KEY — takes ACCESS EXCLUSIVE + validates all rows
--         Must be flagged; large tables → full scan under exclusive lock
ALTER TABLE members ADD PRIMARY KEY (id);

-- CASE 2: ADD FOREIGN KEY without NOT VALID — scans entire table under SHARE ROW EXCLUSIVE
--         Must be flagged; on 50M-row table this can take minutes
ALTER TABLE workspaces ADD CONSTRAINT fk_ws_org
    FOREIGN KEY (org_id) REFERENCES organizations(id);

-- CASE 3: ADD FOREIGN KEY with NOT VALID — acquires lock but skips scan
--         Lower risk; MigraSafe should either not flag or flag at LOW/INFO
ALTER TABLE members ADD CONSTRAINT fk_members_ws
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) NOT VALID;

-- CASE 4: VALIDATE CONSTRAINT — separate scan step; ShareUpdateExclusiveLock
--         Does NOT block reads/writes; should NOT be flagged or be INFO only
ALTER TABLE members VALIDATE CONSTRAINT fk_members_ws;

-- CASE 5: ADD UNIQUE using an existing index (safe metadata-only operation)
ALTER TABLE organizations ADD CONSTRAINT uq_org_slug UNIQUE USING INDEX idx_org_slug_existing;

-- CASE 6: ADD CHECK CONSTRAINT without NOT VALID — scans table
ALTER TABLE members ADD CONSTRAINT chk_role CHECK (role IN ('owner','admin','editor','viewer'));
