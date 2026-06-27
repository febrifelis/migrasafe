import { Issue, Severity, LockType, RollbackDifficulty, DataLossRisk } from "../types";

export type RuleCategory = "data-loss" | "breaking-change" | "performance" | "safety";
export type RuleDialect = "all" | "postgresql" | "mysql";

export interface Rule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
  suggestion?: string;
  category: RuleCategory;
  dialect: RuleDialect;
  lock: LockType;
  rollback: RollbackDifficulty;
  dataLoss: DataLossRisk;
}

export const RULES: Rule[] = [
  // ── CRITICAL ─────────────────────────────────────────────────────────────
  {
    id: "DROP_DATABASE",
    severity: "CRITICAL", category: "data-loss", dialect: "all",
    lock: "access-exclusive", rollback: "irreversible", dataLoss: "certain",
    pattern: /\bDROP\s+DATABASE\b/i,
    message: "DROP DATABASE is irreversible — the entire database and all its data will be permanently destroyed.",
    suggestion: "Never run DROP DATABASE in a migration file. Back up the database and confirm with your team before dropping.",
  },
  {
    id: "ALTER_SYSTEM",
    severity: "CRITICAL", category: "safety", dialect: "postgresql",
    lock: "none", rollback: "hard", dataLoss: "none",
    pattern: /\bALTER\s+SYSTEM\b/i,
    message: "ALTER SYSTEM modifies postgresql.conf directly — a wrong value can make the server unbootable.",
    suggestion: "Never place ALTER SYSTEM in a migration file. Apply server config changes through your infrastructure tooling.",
  },
  {
    id: "DROP_OWNED",
    severity: "CRITICAL", category: "data-loss", dialect: "postgresql",
    lock: "access-exclusive", rollback: "irreversible", dataLoss: "certain",
    pattern: /\bDROP\s+OWNED\s+BY\b/i,
    message: "DROP OWNED BY drops all objects owned by a role — this can silently destroy tables, sequences, and functions.",
    suggestion: "Audit exactly which objects the role owns before running DROP OWNED BY.",
  },
  {
    id: "DROP_TABLE",
    severity: "CRITICAL", category: "data-loss", dialect: "all",
    lock: "access-exclusive", rollback: "irreversible", dataLoss: "certain",
    pattern: /\bDROP\s+TABLE\b/i,
    message: "DROP TABLE is irreversible — all data will be permanently lost.",
    suggestion: "Use soft-delete or rename the table first, then drop it in a later migration.",
  },
  {
    id: "DROP_SCHEMA",
    severity: "CRITICAL", category: "data-loss", dialect: "all",
    lock: "access-exclusive", rollback: "irreversible", dataLoss: "certain",
    pattern: /\bDROP\s+SCHEMA\b/i,
    message: "DROP SCHEMA is irreversible — all tables, views, and data in the schema will be lost.",
    suggestion: "Ensure all objects in the schema are migrated or backed up before dropping.",
  },
  {
    id: "DROP_COLUMN",
    severity: "CRITICAL", category: "data-loss", dialect: "all",
    lock: "access-exclusive", rollback: "irreversible", dataLoss: "certain",
    pattern: /\bDROP\s+COLUMN\b/i,
    message: "DROP COLUMN is irreversible — all column data will be permanently lost.",
    suggestion: "Ensure no application code references this column before dropping it.",
  },
  {
    id: "TRUNCATE",
    severity: "CRITICAL", category: "data-loss", dialect: "all",
    lock: "access-exclusive", rollback: "hard", dataLoss: "certain",
    pattern: /\bTRUNCATE\b/i,
    message: "TRUNCATE will delete all rows in the table immediately.",
    suggestion: "Do not run TRUNCATE in production unless absolutely intentional.",
  },
  {
    id: "DELETE_WITHOUT_WHERE",
    severity: "CRITICAL", category: "data-loss", dialect: "all",
    lock: "row-exclusive", rollback: "hard", dataLoss: "certain",
    pattern: /\bDELETE\b/i,           // broad trigger; refined by matcher below
    message: "DELETE without WHERE will remove every row in the table.",
    suggestion: "Add a WHERE clause to target only the intended rows.",
  },
  // ── HIGH ─────────────────────────────────────────────────────────────────
  {
    id: "UPDATE_WITHOUT_WHERE",
    severity: "HIGH", category: "data-loss", dialect: "all",
    lock: "row-exclusive", rollback: "hard", dataLoss: "certain",
    pattern: /\bUPDATE\b/i,           // broad trigger; refined by matcher below
    message: "UPDATE without WHERE will modify every row in the table.",
    suggestion: "Add a WHERE clause to target only the intended rows.",
  },
  {
    id: "RENAME_TABLE",
    severity: "HIGH", category: "breaking-change", dialect: "all",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bRENAME\s+TABLE\b|\bALTER\s+TABLE\s+\S+\s+RENAME\s+TO\b/i,
    message: "RENAME TABLE is a breaking change — queries using the old name will fail.",
    suggestion: "Create a view with the old name, or update all references before renaming.",
  },
  {
    id: "RENAME_COLUMN",
    severity: "HIGH", category: "breaking-change", dialect: "all",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bRENAME\s+COLUMN\b/i,
    message: "RENAME COLUMN is a breaking change — queries using the old name will fail.",
    suggestion: "Add the new column, backfill data, then drop the old column in a separate migration.",
  },
  {
    id: "ADD_NOT_NULL_WITHOUT_DEFAULT",
    severity: "HIGH", category: "safety", dialect: "all",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bADD\s+COLUMN\s+\S+[\s\S]+?\bNOT\s+NULL\b(?![\s\S]*\bDEFAULT\b)/i,
    message: "ADD COLUMN NOT NULL without DEFAULT will fail on non-empty tables.",
    suggestion: "Use 3 steps: (1) ADD COLUMN nullable, (2) backfill data, (3) SET NOT NULL.",
  },
  {
    id: "ALTER_COLUMN_TYPE",
    severity: "HIGH", category: "safety", dialect: "postgresql",
    lock: "access-exclusive", rollback: "hard", dataLoss: "possible",
    pattern: /\bALTER\s+COLUMN\s+\S+\s+(?:TYPE|SET\s+DATA\s+TYPE)\b/i,
    message: "ALTER COLUMN TYPE may fail if existing data cannot be cast to the new type.",
    suggestion: "Add a USING clause or manually migrate data before changing the column type.",
  },
  {
    id: "ALTER_COLUMN_SET_NOT_NULL",
    severity: "HIGH", category: "safety", dialect: "postgresql",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b/i,
    message: "ALTER COLUMN SET NOT NULL will fail if any existing rows contain NULL in that column.",
    suggestion: "Backfill NULLs first: UPDATE table SET col = default WHERE col IS NULL, then SET NOT NULL.",
  },
  {
    id: "DISABLE_TRIGGER",
    severity: "HIGH", category: "safety", dialect: "postgresql",
    lock: "access-exclusive", rollback: "easy", dataLoss: "possible",
    pattern: /\bDISABLE\s+TRIGGER\b/i,
    message: "DISABLE TRIGGER bypasses trigger-based validation — dirty data may enter the table.",
    suggestion: "Re-enable the trigger immediately after the data operation and validate data integrity.",
  },
  {
    id: "MYSQL_ALTER_TABLE_MODIFY_COLUMN",
    severity: "HIGH", category: "safety", dialect: "mysql",
    lock: "access-exclusive", rollback: "hard", dataLoss: "possible",
    pattern: /\bALTER\s+TABLE\s+\S+\s+MODIFY\s+(?:COLUMN\s+)?\S+/i,
    message: "MODIFY COLUMN may fail if existing data cannot be cast to the new type (MySQL).",
    suggestion: "Test the type change on a copy of the data first.",
  },
  {
    id: "MYSQL_ALTER_TABLE_CHANGE",
    severity: "HIGH", category: "breaking-change", dialect: "mysql",
    lock: "access-exclusive", rollback: "hard", dataLoss: "possible",
    pattern: /\bALTER\s+TABLE\s+\S+\s+CHANGE\s+(?:COLUMN\s+)?/i,
    message: "CHANGE COLUMN renames and/or changes type — a breaking change for queries using the old name (MySQL).",
    suggestion: "Update all application code before renaming the column.",
  },
  // ── MEDIUM ────────────────────────────────────────────────────────────────
  {
    id: "CREATE_INDEX_WITHOUT_CONCURRENTLY",
    severity: "MEDIUM", category: "performance", dialect: "postgresql",
    lock: "share", rollback: "easy", dataLoss: "none",
    pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY)/i,
    message: "CREATE INDEX without CONCURRENTLY locks the table and blocks reads/writes.",
    suggestion: "Use CREATE INDEX CONCURRENTLY to avoid table lock in production.",
  },
  {
    id: "REINDEX_WITHOUT_CONCURRENTLY",
    severity: "MEDIUM", category: "performance", dialect: "postgresql",
    lock: "share", rollback: "easy", dataLoss: "none",
    pattern: /\bREINDEX\b(?!\s+(?:INDEX|TABLE|SCHEMA|DATABASE|SYSTEM)\s+CONCURRENTLY)/i,
    message: "REINDEX without CONCURRENTLY locks the index and blocks reads/writes.",
    suggestion: "Use REINDEX INDEX CONCURRENTLY to avoid locking.",
  },
  {
    id: "DROP_INDEX",
    severity: "MEDIUM", category: "performance", dialect: "all",
    lock: "access-exclusive", rollback: "hard", dataLoss: "none",
    pattern: /\bDROP\s+INDEX\b/i,
    message: "DROP INDEX may degrade query performance for queries that rely on this index.",
    suggestion: "Verify no critical queries depend on this index before dropping it.",
  },
  {
    id: "DROP_CONSTRAINT",
    severity: "MEDIUM", category: "safety", dialect: "all",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bDROP\s+CONSTRAINT\b/i,
    message: "DROP CONSTRAINT removes data validation — may allow dirty data into the table.",
    suggestion: "Ensure application-level validation is in place before dropping the constraint.",
  },
  {
    id: "ADD_UNIQUE_CONSTRAINT",
    severity: "MEDIUM", category: "safety", dialect: "all",
    lock: "share", rollback: "easy", dataLoss: "none",
    pattern: /\bADD\s+CONSTRAINT\s+\S+\s+UNIQUE\b/i,
    message: "ADD UNIQUE CONSTRAINT will fail if duplicate values exist in the column(s).",
    suggestion: "Check for and remove duplicate values before adding the unique constraint.",
  },
  {
    id: "ADD_CHECK_CONSTRAINT",
    severity: "MEDIUM", category: "safety", dialect: "all",
    lock: "share", rollback: "easy", dataLoss: "none",
    pattern: /\bADD\s+CONSTRAINT\s+\S+\s+CHECK\b/i,
    message: "ADD CHECK CONSTRAINT will fail if existing rows violate the constraint.",
    suggestion: "Verify all existing rows satisfy the check condition before adding the constraint.",
  },
  {
    id: "DROP_SEQUENCE",
    severity: "MEDIUM", category: "data-loss", dialect: "postgresql",
    lock: "access-exclusive", rollback: "hard", dataLoss: "possible",
    pattern: /\bDROP\s+SEQUENCE\b/i,
    message: "DROP SEQUENCE may break auto-increment columns or application code that relies on it.",
    suggestion: "Ensure no tables or application code reference this sequence before dropping it.",
  },
  {
    id: "DROP_TYPE",
    severity: "MEDIUM", category: "data-loss", dialect: "postgresql",
    lock: "access-exclusive", rollback: "hard", dataLoss: "possible",
    pattern: /\bDROP\s+TYPE\b/i,
    message: "DROP TYPE may break columns or functions that use this type.",
    suggestion: "Ensure no tables, functions, or application code reference this type before dropping it.",
  },
  {
    id: "DROP_DOMAIN",
    severity: "MEDIUM", category: "data-loss", dialect: "postgresql",
    lock: "access-exclusive", rollback: "hard", dataLoss: "possible",
    pattern: /\bDROP\s+DOMAIN\b/i,
    message: "DROP DOMAIN may break columns or functions that use this domain type.",
    suggestion: "Ensure no tables or functions reference this domain before dropping it.",
  },
  {
    id: "DROP_AGGREGATE",
    severity: "MEDIUM", category: "data-loss", dialect: "postgresql",
    lock: "access-exclusive", rollback: "hard", dataLoss: "none",
    pattern: /\bDROP\s+AGGREGATE\b/i,
    message: "DROP AGGREGATE may break queries that use this aggregate function.",
    suggestion: "Ensure no queries or views reference this aggregate before dropping it.",
  },
  {
    id: "LOCK_TABLE",
    severity: "MEDIUM", category: "performance", dialect: "all",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bLOCK\s+TABLE\b/i,
    message: "LOCK TABLE blocks all reads and writes for the duration of the lock.",
    suggestion: "Minimize lock duration and run during low-traffic windows.",
  },
  {
    id: "CLUSTER",
    severity: "MEDIUM", category: "performance", dialect: "postgresql",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bCLUSTER\s+\S+\s+USING\b|\bCLUSTER\s+\S+\s*;/i,
    message: "CLUSTER rewrites the table in index order and holds an exclusive lock throughout.",
    suggestion: "Run CLUSTER during a maintenance window or consider pg_repack for online reordering.",
  },
  {
    id: "DETACH_PARTITION",
    severity: "MEDIUM", category: "breaking-change", dialect: "postgresql",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bDETACH\s+PARTITION\b/i,
    message: "DETACH PARTITION may break queries and application code targeting that partition.",
    suggestion: "Ensure no application code directly references the partition before detaching.",
  },
  {
    id: "VACUUM_FULL",
    severity: "MEDIUM", category: "performance", dialect: "postgresql",
    lock: "access-exclusive", rollback: "easy", dataLoss: "none",
    pattern: /\bVACUUM\s+FULL\b/i,
    message: "VACUUM FULL acquires an exclusive table lock for the full duration of the operation.",
    suggestion: "Use regular VACUUM or pg_repack for online space reclamation.",
  },
];

function sanitize(sql: string): string {
  return sql
    .replace(/\$([^$]*)\$[\s\S]*?\$\1\$/g, "")        // dollar-quoted bodies
    .replace(/--[^\n]*/g, " ")                          // line comments
    .replace(/\/\*[\s\S]*?\*\//g, " ")                 // block comments
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")               // single-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');              // double-quoted identifiers
}

// Returns true when the sanitized SQL has a WHERE clause at the top level
// (not inside a subquery). We count paren depth to skip nested WHERE clauses.
function hasTopLevelWhere(sql: string): boolean {
  const upper = sql.toUpperCase();
  let depth = 0;
  for (let i = 0; i < upper.length; i++) {
    if (upper[i] === "(") { depth++; continue; }
    if (upper[i] === ")") { depth--; continue; }
    if (depth === 0 && upper.slice(i).match(/^WHERE\b/)) return true;
  }
  return false;
}

// Strip a leading CTE block (WITH ... AS (...) [, ...]) and return the
// remaining DML. This lets isMissingWhere detect DELETE/UPDATE without WHERE
// even when they are preceded by a WITH clause.
function stripCTEPrefix(sql: string): string {
  const trimmed = sql.trimStart();
  if (!/^WITH\b/i.test(trimmed)) return sql;
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth--; continue; }
    // At depth 0 and past the opening "WITH": look for the DML keyword
    if (depth === 0 && i > 0 && /^(UPDATE|DELETE|INSERT|SELECT)\b/i.test(trimmed.slice(i))) {
      return trimmed.slice(i);
    }
  }
  return sql;
}

// Returns true when the statement is DELETE/UPDATE and has no top-level WHERE
function isMissingWhere(sql: string, keyword: "DELETE" | "UPDATE"): boolean {
  // Strip CTE prefix so WITH ... UPDATE/DELETE is handled correctly
  const dml = stripCTEPrefix(sql);
  const upper = dml.toUpperCase().trimStart();
  if (!upper.startsWith(keyword)) return false;
  // USING / JOIN style DELETE that carries the filter in FROM — still flag it;
  // only a real WHERE clause is considered safe.
  return !hasTopLevelWhere(dml);
}

// Detect dialect from SQL content when dialect is "auto"
export function detectDialect(sql: string): "postgresql" | "mysql" {
  const mysqlSignals = /\bENGINE\s*=|\bAUTO_INCREMENT\b|\bTINYINT\b|\bMEDIUMINT\b|\bBACKTICK|`/i;
  const pgSignals = /\bSERIAL\b|\bBIGSERIAL\b|\$\d+|\bRETURNING\b|\bON\s+CONFLICT\b|\bCONCURRENTLY\b/i;
  const pgScore = (sql.match(pgSignals) ?? []).length;
  const myScore = (sql.match(mysqlSignals) ?? []).length;
  return myScore > pgScore ? "mysql" : "postgresql";
}

export function checkStatement(
  statement: string,
  lineNumber: number,
  file: string,
  disableRules: string[] = [],
  severityOverrides: Record<string, Severity> = {},
  dialect: "postgresql" | "mysql" | "auto" = "auto",
  extraRules: Rule[] = []
): Issue[] {
  const issues: Issue[] = [];
  const trimmed = statement.trim();
  if (!trimmed) return issues;

  const sanitized = sanitize(trimmed);

  // Resolve effective dialect for rule filtering
  const effectiveDialect = dialect === "auto" ? detectDialect(sanitized) : dialect;

  for (const rule of [...RULES, ...extraRules]) {
    if (disableRules.includes(rule.id)) continue;
    // Skip rules that don't apply to this dialect
    if (rule.dialect !== "all" && rule.dialect !== effectiveDialect) continue;

    // Use context-aware WHERE-clause check for DELETE/UPDATE
    let matched: boolean;
    if (rule.id === "DELETE_WITHOUT_WHERE") {
      matched = isMissingWhere(sanitized, "DELETE");
    } else if (rule.id === "UPDATE_WITHOUT_WHERE") {
      matched = isMissingWhere(sanitized, "UPDATE");
    } else {
      matched = rule.pattern.test(sanitized);
    }

    if (matched) {
      const severity = severityOverrides[rule.id] ?? rule.severity;
      issues.push({
        ruleId: rule.id,
        severity,
        file,
        line: lineNumber,
        statement: trimmed.split("\n")[0].substring(0, 120),
        message: rule.message,
        suggestion: rule.suggestion,
      });
    }
  }

  return issues;
}
