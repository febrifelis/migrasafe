import { StatementKind } from "../ast/types";

interface CoveredKind {
  kind: StatementKind;
  ruleCount: number;
  description: string;
}

const COVERED: CoveredKind[] = [
  { kind: "drop_table",              ruleCount: 1, description: "DROP TABLE — data loss detection" },
  { kind: "drop_column",             ruleCount: 1, description: "DROP COLUMN — irreversible data loss" },
  { kind: "drop_database",           ruleCount: 1, description: "DROP DATABASE — catastrophic data loss" },
  { kind: "drop_schema",             ruleCount: 1, description: "DROP SCHEMA — schema-wide data loss" },
  { kind: "drop_sequence",           ruleCount: 1, description: "DROP SEQUENCE — breaks auto-increment columns" },
  { kind: "drop_type",               ruleCount: 1, description: "DROP TYPE — breaks dependent columns/functions" },
  { kind: "drop_domain",             ruleCount: 1, description: "DROP DOMAIN — breaks dependent columns" },
  { kind: "drop_aggregate",          ruleCount: 1, description: "DROP AGGREGATE — breaks dependent queries" },
  { kind: "drop_index",              ruleCount: 1, description: "DROP INDEX — performance degradation" },
  { kind: "drop_constraint",         ruleCount: 1, description: "DROP CONSTRAINT — data integrity risk" },
  { kind: "drop_owned",              ruleCount: 1, description: "DROP OWNED BY — role-wide data loss" },
  { kind: "alter_add_column",        ruleCount: 1, description: "ADD COLUMN NOT NULL without DEFAULT — table lock" },
  { kind: "alter_drop_column",       ruleCount: 1, description: "DROP COLUMN — irreversible" },
  { kind: "alter_rename_table",      ruleCount: 1, description: "RENAME TABLE — breaking change" },
  { kind: "alter_rename_column",     ruleCount: 1, description: "RENAME COLUMN — breaking change" },
  { kind: "alter_set_not_null",      ruleCount: 1, description: "SET NOT NULL — full table scan, lock" },
  { kind: "alter_alter_column_type", ruleCount: 2, description: "ALTER COLUMN TYPE — table rewrite, cast failure" },
  { kind: "alter_drop_constraint",   ruleCount: 1, description: "DROP CONSTRAINT — data integrity bypass" },
  { kind: "alter_disable_trigger",   ruleCount: 1, description: "DISABLE TRIGGER — dirty data risk" },
  { kind: "alter_system",            ruleCount: 1, description: "ALTER SYSTEM — server config, unbootable risk" },
  { kind: "create_index",            ruleCount: 1, description: "CREATE INDEX without CONCURRENTLY — write lock" },
  { kind: "delete",                  ruleCount: 1, description: "DELETE without WHERE — full table deletion" },
  { kind: "update",                  ruleCount: 1, description: "UPDATE without WHERE — full table update" },
  { kind: "truncate",                ruleCount: 1, description: "TRUNCATE — immediate full row deletion" },
  { kind: "reindex",                 ruleCount: 1, description: "REINDEX without CONCURRENTLY — index lock" },
  { kind: "vacuum_full",             ruleCount: 1, description: "VACUUM FULL — exclusive lock, table rewrite" },
  { kind: "cluster",                 ruleCount: 1, description: "CLUSTER — exclusive lock, table rewrite" },
  { kind: "lock_table",              ruleCount: 1, description: "LOCK TABLE — explicit block on reads/writes" },
  { kind: "detach_partition",        ruleCount: 1, description: "DETACH PARTITION — breaking change" },
];

const PARTIALLY_COVERED: { kind: string; description: string }[] = [
  { kind: "create_table",  description: "CREATE TABLE — detected; no dangerous patterns flagged yet" },
  { kind: "create_view",   description: "CREATE VIEW — detected; no dangerous patterns flagged yet" },
  { kind: "create_function", description: "CREATE FUNCTION — detected; no dangerous patterns flagged yet" },
  { kind: "insert",        description: "INSERT — detected; only flagged via plugin rules" },
  { kind: "select",        description: "SELECT — parsed; no rules apply" },
  { kind: "analyze",       description: "ANALYZE — parsed; no rules apply" },
];

const UNCOVERED: string[] = [
  "GRANT / REVOKE — permission changes",
  "SET search_path — schema hijacking risk",
  "COPY FROM — bulk import with no validation",
  "pg_restore / pg_dump — backup/restore operations",
  "Stored procedure bodies (PL/pgSQL) — logic analysis",
  "Multi-step transaction blocks — BEGIN/COMMIT isolation",
  "DO $$ ... $$ anonymous blocks — arbitrary code execution",
];

export interface CoverageReport {
  coveredCount: number;
  partiallyCoveredCount: number;
  uncoveredCount: number;
  coveragePercent: number;
  covered: CoveredKind[];
  partiallyCovered: typeof PARTIALLY_COVERED;
  uncovered: string[];
}

export function generateCoverageReport(): CoverageReport {
  const total = COVERED.length + PARTIALLY_COVERED.length + UNCOVERED.length;
  const effective = COVERED.length + PARTIALLY_COVERED.length * 0.5;
  return {
    coveredCount: COVERED.length,
    partiallyCoveredCount: PARTIALLY_COVERED.length,
    uncoveredCount: UNCOVERED.length,
    coveragePercent: Math.round((effective / total) * 100),
    covered: COVERED,
    partiallyCovered: PARTIALLY_COVERED,
    uncovered: UNCOVERED,
  };
}

export function formatCoverageText(r: CoverageReport): string {
  const lines: string[] = [
    `\nMigraSafe Engine Coverage Report`,
    `─────────────────────────────────────────`,
    `  Fully covered    : ${r.coveredCount} statement types`,
    `  Partially covered: ${r.partiallyCoveredCount} statement types`,
    `  Not yet covered  : ${r.uncoveredCount} statement types`,
    `  Coverage score   : ${r.coveragePercent}%`,
    ``,
    `✔ Fully Covered (${r.coveredCount}):`,
  ];
  for (const c of r.covered) {
    const rules = c.ruleCount === 1 ? "1 rule" : `${c.ruleCount} rules`;
    lines.push(`  [${rules.padEnd(6)}] ${c.kind.padEnd(28)} ${c.description}`);
  }
  lines.push(`\n◐ Partially Covered (${r.partiallyCoveredCount}):`);
  for (const c of r.partiallyCovered) {
    lines.push(`  ${c.kind.padEnd(36)} ${c.description}`);
  }
  lines.push(`\n✗ Not Yet Covered (${r.uncoveredCount}):`);
  for (const u of r.uncovered) {
    lines.push(`  ${u}`);
  }
  lines.push("");
  return lines.join("\n");
}
