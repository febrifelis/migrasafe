import { Issue, Severity } from "../types";

interface Rule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
  suggestion?: string;
}

const RULES: Rule[] = [
  {
    id: "DROP_DATABASE",
    severity: "CRITICAL",
    pattern: /\bDROP\s+DATABASE\b/i,
    message: "DROP DATABASE is irreversible — the entire database and all its data will be permanently destroyed.",
    suggestion: "Never run DROP DATABASE in a migration file. Back up the database and confirm with your team before dropping.",
  },
  {
    id: "ALTER_SYSTEM",
    severity: "CRITICAL",
    pattern: /\bALTER\s+SYSTEM\b/i,
    message: "ALTER SYSTEM modifies postgresql.conf directly — a wrong value can make the server unbootable.",
    suggestion: "Never place ALTER SYSTEM in a migration file. Apply server config changes through your infrastructure tooling.",
  },
  {
    id: "DROP_OWNED",
    severity: "CRITICAL",
    pattern: /\bDROP\s+OWNED\s+BY\b/i,
    message: "DROP OWNED BY drops all objects owned by a role — this can silently destroy tables, sequences, and functions.",
    suggestion: "Audit exactly which objects the role owns before running DROP OWNED BY.",
  },
  {
    id: "DROP_TABLE",
    severity: "CRITICAL",
    pattern: /\bDROP\s+TABLE\b/i,
    message: "DROP TABLE is irreversible — all data will be permanently lost.",
    suggestion: "Use soft-delete or rename the table first, then drop it in a later migration.",
  },
  {
    id: "DROP_SCHEMA",
    severity: "CRITICAL",
    pattern: /\bDROP\s+SCHEMA\b/i,
    message: "DROP SCHEMA is irreversible — all tables, views, and data in the schema will be lost.",
    suggestion: "Ensure all objects in the schema are migrated or backed up before dropping.",
  },
  {
    id: "DROP_COLUMN",
    severity: "CRITICAL",
    pattern: /\bDROP\s+COLUMN\b/i,
    message: "DROP COLUMN is irreversible — all column data will be permanently lost.",
    suggestion: "Ensure no application code references this column before dropping it.",
  },
  {
    id: "TRUNCATE",
    severity: "CRITICAL",
    pattern: /\bTRUNCATE\b/i,
    message: "TRUNCATE will delete all rows in the table immediately.",
    suggestion: "Do not run TRUNCATE in production unless absolutely intentional.",
  },
  {
    id: "DELETE_WITHOUT_WHERE",
    severity: "CRITICAL",
    pattern: /\bDELETE\s+FROM\s+\S+\s*(?:;|$)/i,
    message: "DELETE without WHERE will remove every row in the table.",
    suggestion: "Add a WHERE clause to target only the intended rows.",
  },
  {
    id: "UPDATE_WITHOUT_WHERE",
    severity: "HIGH",
    pattern: /\bUPDATE\s+\S+\s+SET\b(?![\s\S]*\bWHERE\b)/i,
    message: "UPDATE without WHERE will modify every row in the table.",
    suggestion: "Add a WHERE clause to target only the intended rows.",
  },
  {
    id: "RENAME_TABLE",
    severity: "HIGH",
    pattern: /\bRENAME\s+TABLE\b|\bALTER\s+TABLE\s+\S+\s+RENAME\s+TO\b/i,
    message: "RENAME TABLE is a breaking change — queries using the old name will fail.",
    suggestion: "Create a view with the old name, or update all references before renaming.",
  },
  {
    id: "RENAME_COLUMN",
    severity: "HIGH",
    pattern: /\bRENAME\s+COLUMN\b/i,
    message: "RENAME COLUMN is a breaking change — queries using the old name will fail.",
    suggestion: "Add the new column, backfill data, then drop the old column in a separate migration.",
  },
  {
    id: "ADD_NOT_NULL_WITHOUT_DEFAULT",
    severity: "HIGH",
    pattern: /\bADD\s+COLUMN\s+\S+[\s\S]+?\bNOT\s+NULL\b(?![\s\S]*\bDEFAULT\b)/i,
    message: "ADD COLUMN NOT NULL without DEFAULT will fail on non-empty tables.",
    suggestion: "Use 3 steps: (1) ADD COLUMN nullable, (2) backfill data, (3) SET NOT NULL.",
  },
  {
    id: "ALTER_COLUMN_TYPE",
    severity: "HIGH",
    pattern: /\bALTER\s+COLUMN\s+\S+\s+(?:TYPE|SET\s+DATA\s+TYPE)\b/i,
    message: "ALTER COLUMN TYPE may fail if existing data cannot be cast to the new type.",
    suggestion: "Add a USING clause or manually migrate data before changing the column type.",
  },
  {
    id: "ALTER_COLUMN_SET_NOT_NULL",
    severity: "HIGH",
    pattern: /\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b/i,
    message: "ALTER COLUMN SET NOT NULL will fail if any existing rows contain NULL in that column.",
    suggestion: "Backfill NULLs first: UPDATE table SET col = default WHERE col IS NULL, then SET NOT NULL.",
  },
  {
    id: "CREATE_INDEX_WITHOUT_CONCURRENTLY",
    severity: "MEDIUM",
    pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY)/i,
    message: "CREATE INDEX without CONCURRENTLY locks the table and blocks reads/writes.",
    suggestion: "Use CREATE INDEX CONCURRENTLY to avoid table lock in production.",
  },
  {
    id: "DROP_INDEX",
    severity: "MEDIUM",
    pattern: /\bDROP\s+INDEX\b/i,
    message: "DROP INDEX may degrade query performance for queries that rely on this index.",
    suggestion: "Verify no critical queries depend on this index before dropping it.",
  },
  {
    id: "DROP_CONSTRAINT",
    severity: "MEDIUM",
    pattern: /\bDROP\s+CONSTRAINT\b/i,
    message: "DROP CONSTRAINT removes data validation — may allow dirty data into the table.",
    suggestion: "Ensure application-level validation is in place before dropping the constraint.",
  },
  {
    id: "ADD_UNIQUE_CONSTRAINT",
    severity: "MEDIUM",
    pattern: /\bADD\s+CONSTRAINT\s+\S+\s+UNIQUE\b/i,
    message: "ADD UNIQUE CONSTRAINT will fail if duplicate values exist in the column(s).",
    suggestion: "Check for and remove duplicate values before adding the unique constraint.",
  },
  {
    id: "DROP_SEQUENCE",
    severity: "MEDIUM",
    pattern: /\bDROP\s+SEQUENCE\b/i,
    message: "DROP SEQUENCE may break auto-increment columns or application code that relies on it.",
    suggestion: "Ensure no tables or application code reference this sequence before dropping it.",
  },
  {
    id: "DROP_TYPE",
    severity: "MEDIUM",
    pattern: /\bDROP\s+TYPE\b/i,
    message: "DROP TYPE may break columns or functions that use this type.",
    suggestion: "Ensure no tables, functions, or application code reference this type before dropping it.",
  },
  {
    id: "ADD_CHECK_CONSTRAINT",
    severity: "MEDIUM",
    pattern: /\bADD\s+CONSTRAINT\s+\S+\s+CHECK\b/i,
    message: "ADD CHECK CONSTRAINT will fail if existing rows violate the constraint.",
    suggestion: "Verify all existing rows satisfy the check condition before adding the constraint.",
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

export function checkStatement(
  statement: string,
  lineNumber: number,
  file: string
): Issue[] {
  const issues: Issue[] = [];
  const trimmed = statement.trim();
  if (!trimmed) return issues;

  const sanitized = sanitize(trimmed);

  for (const rule of RULES) {
    if (rule.pattern.test(sanitized)) {
      issues.push({
        severity: rule.severity,
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
