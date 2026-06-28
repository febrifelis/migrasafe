import { ParsedStatement, StatementKind } from "../ast/types";

export type RollbackCategory = "easy" | "medium" | "hard" | "impossible";

export interface RollbackAnalysis {
  category: RollbackCategory;
  score: number;       // 0–100 (higher = harder to rollback)
  reason: string;
  steps: string[];
  estimatedEffort: string;
}

const IMPOSSIBLE_KINDS = new Set<StatementKind>([
  "drop_table", "drop_column", "drop_database", "drop_schema",
  "drop_owned", "truncate",
]);

const HARD_KINDS = new Set<StatementKind>([
  "drop_index", "drop_sequence", "drop_type", "drop_domain",
  "drop_aggregate", "drop_function", "drop_trigger", "drop_view",
  "drop_constraint", "alter_alter_column_type",
  "vacuum_full", "cluster", "detach_partition",
]);

const MEDIUM_KINDS = new Set<StatementKind>([
  "alter_drop_column", "alter_rename_table", "alter_rename_column",
  "alter_drop_constraint", "alter_disable_trigger",
  "delete", "update", "reindex", "lock_table", "alter_system",
]);

export function analyzeRollback(stmt: ParsedStatement): RollbackAnalysis {
  if (IMPOSSIBLE_KINDS.has(stmt.kind)) {
    return {
      category: "impossible",
      score: 100,
      reason: "Data or object is permanently destroyed. No DDL rollback can recover lost data.",
      steps: [
        "Restore from a recent backup.",
        "Use point-in-time recovery (PITR) if WAL archiving is enabled.",
      ],
      estimatedEffort: "Hours to days depending on backup availability and database size.",
    };
  }

  if (stmt.kind === "delete" || stmt.kind === "update") {
    if (!stmt.hasWhere) {
      return {
        category: "impossible",
        score: 95,
        reason: "All rows were modified with no WHERE clause. Unless inside an uncommitted transaction, data is gone.",
        steps: [
          "If still in transaction: ROLLBACK immediately.",
          "Otherwise: restore from backup or use PITR.",
        ],
        estimatedEffort: "Immediate (ROLLBACK) or hours to days (backup restore).",
      };
    }
    return {
      category: "medium",
      score: 55,
      reason: "DML with WHERE: data modified for matched rows. Reversible if in a transaction or backups exist.",
      steps: [
        "If still in transaction: ROLLBACK.",
        "Otherwise: re-insert or update rows from backup data.",
      ],
      estimatedEffort: "Minutes to hours depending on rows affected.",
    };
  }

  if (HARD_KINDS.has(stmt.kind)) {
    const stepsMap: Partial<Record<StatementKind, string[]>> = {
      alter_alter_column_type: [
        "Run the reverse ALTER COLUMN TYPE to revert the type.",
        "Data may have been coerced — verify correctness after rollback.",
      ],
      drop_index: [
        "Recreate the index with the original definition.",
        "Use CREATE INDEX CONCURRENTLY to avoid downtime.",
      ],
      drop_view: ["Recreate the view with the original query."],
      drop_function: ["Recreate the function from source control."],
      vacuum_full:   ["No rollback needed — VACUUM is non-destructive."],
      cluster:       ["Re-run CLUSTER to restore physical ordering if required."],
    };
    return {
      category: "hard",
      score: 75,
      reason: "Object can be recreated but may require manual effort and verification.",
      steps: stepsMap[stmt.kind] ?? ["Recreate the object from source control or backup metadata."],
      estimatedEffort: "Minutes to hours.",
    };
  }

  if (MEDIUM_KINDS.has(stmt.kind)) {
    return {
      category: "medium",
      score: 50,
      reason: "Operation is reversible but requires a compensating DDL or DML statement.",
      steps: [
        "Apply the inverse operation (e.g., RENAME back, re-enable trigger, DROP new column).",
        "Verify application behavior after rollback.",
      ],
      estimatedEffort: "Minutes.",
    };
  }

  // easy: add column, add constraint, create index, etc.
  return {
    category: "easy",
    score: 15,
    reason: "Operation is additive and can be reversed with a single compensating statement.",
    steps: ["Apply the inverse DDL (e.g., DROP the added column or constraint)."],
    estimatedEffort: "Seconds to minutes.",
  };
}
