/**
 * Rule-based safe migration patterns library.
 * Each entry maps a rule ID to a step-by-step safe migration guide.
 */

export interface MigrationPattern {
  ruleId: string;
  title: string;
  risk: string;
  safeApproach: string[];
  example?: string;
  reference?: string;
}

const PATTERNS: MigrationPattern[] = [
  {
    ruleId: "DROP_TABLE",
    title: "Safely remove a table",
    risk: "Permanent data loss — cannot be rolled back without a backup.",
    safeApproach: [
      "Step 1: Rename the table first: ALTER TABLE orders RENAME TO orders_deprecated_20260628",
      "Step 2: Deploy and monitor for 1–2 release cycles to confirm nothing references it.",
      "Step 3: Only then drop it in a later migration.",
    ],
    example: `-- Migration 001: rename
ALTER TABLE orders RENAME TO orders_deprecated_20260628;

-- Migration 002 (2 weeks later): drop
DROP TABLE orders_deprecated_20260628;`,
  },
  {
    ruleId: "DROP_COLUMN",
    title: "Safely remove a column",
    risk: "Data in the column is permanently lost once dropped.",
    safeApproach: [
      "Step 1: Remove all application reads/writes from the column first (deploy code).",
      "Step 2: Mark the column deprecated in a comment: COMMENT ON COLUMN t.col IS 'deprecated'",
      "Step 3: In the next migration cycle, drop it: ALTER TABLE t DROP COLUMN col",
    ],
    example: `-- Migration 001: stop using the column in app code (deploy)
-- Migration 002: mark deprecated
COMMENT ON COLUMN users.legacy_field IS 'deprecated — remove after 2026-08-01';

-- Migration 003 (after confirming no usage):
ALTER TABLE users DROP COLUMN legacy_field;`,
  },
  {
    ruleId: "ADD_NOT_NULL_COLUMN",
    title: "Add a NOT NULL column to a large table",
    risk: "PostgreSQL rewrites the whole table and holds an ACCESS EXCLUSIVE lock for the duration.",
    safeApproach: [
      "Step 1: Add the column as nullable with a default: ALTER TABLE t ADD COLUMN col INT DEFAULT 0",
      "Step 2: Backfill existing rows in batches: UPDATE t SET col = 0 WHERE col IS NULL LIMIT 10000",
      "Step 3: Add the NOT NULL constraint: ALTER TABLE t ALTER COLUMN col SET NOT NULL",
      "Step 4 (PostgreSQL 12+): Use ADD COLUMN ... DEFAULT ... NOT NULL (single DDL, no rewrite for constant defaults)",
    ],
    example: `-- For PostgreSQL 12+, a constant default avoids a table rewrite:
ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false;

-- For computed defaults or older PG versions:
ALTER TABLE users ADD COLUMN score INT;
UPDATE users SET score = 0 WHERE score IS NULL; -- batch this
ALTER TABLE users ALTER COLUMN score SET NOT NULL;`,
    reference: "https://www.postgresql.org/docs/current/sql-altertable.html",
  },
  {
    ruleId: "RENAME_TABLE",
    title: "Rename a table without downtime",
    risk: "All queries using the old name break immediately — no grace period.",
    safeApproach: [
      "Step 1: Create a view with the old name pointing to the new table.",
      "Step 2: Update all application code to use the new name.",
      "Step 3: Remove the view after all code is deployed.",
    ],
    example: `-- Step 1: rename and create compatibility view
ALTER TABLE orders RENAME TO purchase_orders;
CREATE VIEW orders AS SELECT * FROM purchase_orders;

-- Step 2: update application code

-- Step 3: drop the view
DROP VIEW orders;`,
  },
  {
    ruleId: "RENAME_COLUMN",
    title: "Rename a column without downtime",
    risk: "All queries using the old name break immediately.",
    safeApproach: [
      "Step 1: Add the new column and copy data: ALTER TABLE t ADD COLUMN new_name TEXT",
      "Step 2: Use a trigger to keep both columns in sync during the transition.",
      "Step 3: Update application code to use the new column name.",
      "Step 4: Drop the old column after all code is deployed.",
    ],
    example: `-- Step 1: add new column
ALTER TABLE users ADD COLUMN full_name TEXT;
UPDATE users SET full_name = name;

-- Step 2: sync trigger
CREATE OR REPLACE FUNCTION sync_name() RETURNS TRIGGER AS $$
BEGIN NEW.full_name = NEW.name; NEW.name = NEW.full_name; RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER sync_name_trigger BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_name();

-- Step 3: deploy app code pointing to full_name
-- Step 4: drop old column and trigger
DROP TRIGGER sync_name_trigger ON users;
DROP FUNCTION sync_name();
ALTER TABLE users DROP COLUMN name;`,
  },
  {
    ruleId: "DELETE_WITHOUT_WHERE",
    title: "Delete all rows safely",
    risk: "Deletes every row — irreversible without a backup.",
    safeApproach: [
      "Use TRUNCATE only if you truly want all rows deleted and are in a transaction.",
      "For partial deletes, always add a WHERE clause with a specific condition.",
      "For large tables, batch delete: DELETE FROM t WHERE id IN (SELECT id FROM t LIMIT 10000)",
    ],
    example: `-- Safe batch delete:
DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '90 days' AND id IN (
  SELECT id FROM audit_logs WHERE created_at < now() - INTERVAL '90 days' LIMIT 5000
);`,
  },
  {
    ruleId: "UPDATE_WITHOUT_WHERE",
    title: "Update all rows safely",
    risk: "Updates every row in the table — can cause data corruption if accidental.",
    safeApproach: [
      "Always include a WHERE clause, even if updating all rows: WHERE 1=1 (makes intent explicit).",
      "For large tables, batch update to avoid long locks: UPDATE t SET col = val WHERE id BETWEEN 1 AND 10000",
      "Test with a SELECT first: SELECT COUNT(*) FROM t WHERE <your condition>",
    ],
    example: `-- Test first:
SELECT COUNT(*) FROM users WHERE status IS NULL;

-- Then update with explicit condition:
UPDATE users SET status = 'active' WHERE status IS NULL;`,
  },
  {
    ruleId: "ADD_COLUMN_DEFAULT",
    title: "Add a column with a volatile default",
    risk: "Rewrites the whole table with an ACCESS EXCLUSIVE lock.",
    safeApproach: [
      "For PostgreSQL 12+: constant defaults (NULL, 0, 'text', false) are metadata-only — no rewrite.",
      "For volatile defaults (now(), gen_random_uuid()): add column nullable, backfill, then set default.",
    ],
    example: `-- PostgreSQL 12+ constant default (safe, no rewrite):
ALTER TABLE orders ADD COLUMN priority INT NOT NULL DEFAULT 1;

-- Volatile default (safe approach):
ALTER TABLE orders ADD COLUMN created_uuid UUID;
UPDATE orders SET created_uuid = gen_random_uuid(); -- batch if large
ALTER TABLE orders ALTER COLUMN created_uuid SET DEFAULT gen_random_uuid();
ALTER TABLE orders ALTER COLUMN created_uuid SET NOT NULL;`,
  },
  {
    ruleId: "CREATE_INDEX_WITHOUT_CONCURRENTLY",
    title: "Create an index without blocking reads/writes",
    risk: "A regular CREATE INDEX holds a ShareLock, blocking all writes for the duration.",
    safeApproach: [
      "Always use CREATE INDEX CONCURRENTLY for production tables with live traffic.",
      "Note: CONCURRENTLY cannot run inside a transaction block.",
      "CONCURRENTLY takes longer but never blocks reads or writes.",
    ],
    example: `-- Safe for production:
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- If CONCURRENTLY fails (e.g., due to deadlock), clean up:
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;
-- Then retry.`,
    reference: "https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY",
  },
  {
    ruleId: "DROP_INDEX_WITHOUT_CONCURRENTLY",
    title: "Drop an index without blocking reads/writes",
    risk: "A regular DROP INDEX holds an ACCESS EXCLUSIVE lock, blocking all reads and writes.",
    safeApproach: [
      "Use DROP INDEX CONCURRENTLY to avoid locking.",
    ],
    example: `DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;`,
  },
];

const PATTERN_MAP = new Map(PATTERNS.map((p) => [p.ruleId, p]));

export function getSuggestionForRule(ruleId: string): MigrationPattern | undefined {
  return PATTERN_MAP.get(ruleId);
}

export function getAllPatterns(): MigrationPattern[] {
  return PATTERNS;
}

/** Format a migration pattern as a readable text block */
export function formatPattern(p: MigrationPattern): string {
  const lines: string[] = [];
  lines.push(`\n${"─".repeat(60)}`);
  lines.push(`Rule: ${p.ruleId}`);
  lines.push(`Topic: ${p.title}`);
  lines.push(`Risk: ${p.risk}`);
  lines.push("");
  lines.push("Safe approach:");
  for (const step of p.safeApproach) {
    lines.push(`  • ${step}`);
  }
  if (p.example) {
    lines.push("");
    lines.push("Example:");
    lines.push(p.example.split("\n").map((l) => `  ${l}`).join("\n"));
  }
  if (p.reference) {
    lines.push("");
    lines.push(`Reference: ${p.reference}`);
  }
  return lines.join("\n");
}
