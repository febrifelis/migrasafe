import { ParsedStatement, StatementKind } from "../ast/types";

export type LockMode =
  | "ACCESS SHARE"
  | "ROW SHARE"
  | "ROW EXCLUSIVE"
  | "SHARE UPDATE EXCLUSIVE"
  | "SHARE"
  | "SHARE ROW EXCLUSIVE"
  | "EXCLUSIVE"
  | "ACCESS EXCLUSIVE";

export type LockSeverity = "none" | "low" | "medium" | "high" | "critical";

export interface LockAnalysis {
  mode: LockMode;
  severity: LockSeverity;
  score: number;           // 0–100
  canConcurrentRead: boolean;
  canConcurrentWrite: boolean;
  blocksAll: boolean;
  reason: string;
  suggestion?: string;
}

const LOCK_MAP: Partial<Record<StatementKind, LockMode>> = {
  select:                    "ACCESS SHARE",
  insert:                    "ROW EXCLUSIVE",
  update:                    "ROW EXCLUSIVE",
  delete:                    "ROW EXCLUSIVE",
  create_index:              "SHARE",            // non-concurrent; concurrent → SHARE UPDATE EXCLUSIVE
  alter_add_column:          "ACCESS EXCLUSIVE",
  alter_drop_column:         "ACCESS EXCLUSIVE",
  alter_alter_column_type:   "ACCESS EXCLUSIVE",
  alter_set_not_null:        "ACCESS EXCLUSIVE",
  alter_drop_not_null:       "ACCESS EXCLUSIVE",
  alter_set_default:         "ACCESS EXCLUSIVE",
  alter_drop_default:        "ACCESS EXCLUSIVE",
  alter_add_constraint:      "ACCESS EXCLUSIVE",
  alter_drop_constraint:     "ACCESS EXCLUSIVE",
  alter_rename_table:        "ACCESS EXCLUSIVE",
  alter_rename_column:       "ACCESS EXCLUSIVE",
  alter_disable_trigger:     "ACCESS EXCLUSIVE",
  alter_enable_trigger:      "ACCESS EXCLUSIVE",
  alter_system:              "ACCESS EXCLUSIVE",
  drop_table:                "ACCESS EXCLUSIVE",
  drop_column:               "ACCESS EXCLUSIVE",
  drop_index:                "ACCESS EXCLUSIVE",
  drop_schema:               "ACCESS EXCLUSIVE",
  drop_sequence:             "ACCESS EXCLUSIVE",
  drop_type:                 "ACCESS EXCLUSIVE",
  drop_domain:               "ACCESS EXCLUSIVE",
  drop_view:                 "ACCESS EXCLUSIVE",
  drop_owned:                "ACCESS EXCLUSIVE",
  drop_constraint:           "ACCESS EXCLUSIVE",
  drop_database:             "ACCESS EXCLUSIVE",
  truncate:                  "ACCESS EXCLUSIVE",
  vacuum_full:               "ACCESS EXCLUSIVE",
  cluster:                   "ACCESS EXCLUSIVE",
  lock_table:                "ACCESS EXCLUSIVE",
  reindex:                   "ACCESS EXCLUSIVE", // non-concurrent; concurrent → SHARE UPDATE EXCLUSIVE
  create_table:              "ACCESS EXCLUSIVE",
  create_view:               "ACCESS SHARE",
  create_function:           "ACCESS SHARE",
  create_sequence:           "ACCESS EXCLUSIVE",
  create_type:               "ACCESS EXCLUSIVE",
  analyze:                   "SHARE UPDATE EXCLUSIVE",
  vacuum:                    "SHARE UPDATE EXCLUSIVE",
  detach_partition:          "ACCESS EXCLUSIVE",
};

const SCORE_MAP: Record<LockMode, number> = {
  "ACCESS SHARE":           5,
  "ROW SHARE":             10,
  "ROW EXCLUSIVE":         20,
  "SHARE UPDATE EXCLUSIVE":35,
  "SHARE":                 50,
  "SHARE ROW EXCLUSIVE":   65,
  "EXCLUSIVE":             80,
  "ACCESS EXCLUSIVE":     100,
};

const SEVERITY_MAP: Record<LockMode, LockSeverity> = {
  "ACCESS SHARE":           "none",
  "ROW SHARE":              "low",
  "ROW EXCLUSIVE":          "low",
  "SHARE UPDATE EXCLUSIVE": "medium",
  "SHARE":                  "medium",
  "SHARE ROW EXCLUSIVE":    "high",
  "EXCLUSIVE":              "high",
  "ACCESS EXCLUSIVE":       "critical",
};

export function analyzeLock(stmt: ParsedStatement): LockAnalysis {
  let mode: LockMode = LOCK_MAP[stmt.kind] ?? "ACCESS EXCLUSIVE";

  // CONCURRENTLY variants use lighter locks
  if (stmt.isConcurrent) {
    if (stmt.kind === "create_index" || stmt.kind === "reindex") {
      mode = "SHARE UPDATE EXCLUSIVE";
    }
  }

  const score    = SCORE_MAP[mode];
  const severity = SEVERITY_MAP[mode];

  const canConcurrentRead  = mode === "ACCESS SHARE" || mode === "ROW SHARE" || mode === "ROW EXCLUSIVE" || mode === "SHARE UPDATE EXCLUSIVE" || mode === "SHARE";
  const canConcurrentWrite = mode === "ACCESS SHARE" || mode === "ROW SHARE" || mode === "ROW EXCLUSIVE";
  const blocksAll          = mode === "ACCESS EXCLUSIVE";

  const reasonMap: Record<LockMode, string> = {
    "ACCESS SHARE":           "Read-only lock. Does not block any concurrent operation.",
    "ROW SHARE":              "Row-level share. Blocks only explicit EXCLUSIVE table locks.",
    "ROW EXCLUSIVE":          "Row-level exclusive. Concurrent reads and row-level writes allowed.",
    "SHARE UPDATE EXCLUSIVE": "Blocks schema changes but allows concurrent reads and writes.",
    "SHARE":                  "Blocks concurrent writes and other SHARE UPDATE EXCLUSIVE locks.",
    "SHARE ROW EXCLUSIVE":    "Blocks writes and other SHARE locks. Reads still allowed.",
    "EXCLUSIVE":              "Blocks reads and writes except for ACCESS SHARE (simple SELECTs).",
    "ACCESS EXCLUSIVE":       "Blocks ALL concurrent access — reads and writes are queued until lock is released.",
  };

  const suggestion = blocksAll
    ? "Consider running this operation during a low-traffic window. Use lock_timeout to avoid indefinite waits: SET lock_timeout = '5s'."
    : undefined;

  return {
    mode, score, severity,
    canConcurrentRead, canConcurrentWrite, blocksAll,
    reason: reasonMap[mode],
    suggestion,
  };
}
