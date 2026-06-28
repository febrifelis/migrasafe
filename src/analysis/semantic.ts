import { ParsedStatement } from "../ast/types";

export type WorkflowKind =
  | "safe-add-not-null"
  | "safe-column-rename"
  | "safe-column-type-change"
  | "safe-index-creation"
  | "safe-fk-addition"
  | "backfill-pattern"
  | "zero-downtime-rename"
  | "bare-set-not-null"
  | "drop-without-rename"
  | "missing-concurrent-index";

export type WorkflowType = "safe-workflow" | "missing-step" | "advisory";

export interface SemanticWarning {
  type:       WorkflowType;
  kind:       WorkflowKind;
  message:    string;
  lines:      number[];
  suggestion: string;
}

export interface SemanticResult {
  warnings:   SemanticWarning[];
  workflows:  string[];
}

export function analyzeSemantic(stmts: ParsedStatement[]): SemanticResult {
  const warnings:  SemanticWarning[] = [];
  const workflows: string[] = [];

  detectSafeAddNotNull(stmts, warnings, workflows);
  detectBareSetNotNull(stmts, warnings);
  detectSafeColumnRename(stmts, warnings, workflows);
  detectDropWithoutRename(stmts, warnings);
  detectSafeColumnTypeChange(stmts, warnings, workflows);
  detectSafeIndexCreation(stmts, warnings, workflows);
  detectSafeFkAddition(stmts, warnings, workflows);
  detectBackfillPattern(stmts, warnings, workflows);

  return { warnings, workflows };
}

// ── Pattern 1: ADD COLUMN nullable → UPDATE backfill → SET NOT NULL ──────────

function detectSafeAddNotNull(
  stmts: ParsedStatement[],
  warnings: SemanticWarning[],
  workflows: string[]
): void {
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    if (s.kind !== "alter_add_column" || !s.columnDef?.nullable || !s.table || !s.column) continue;
    const table = s.table.toLowerCase();
    const col   = s.column.toLowerCase();

    const updateIdx = stmts.slice(i + 1).findIndex(
      (x) => x.kind === "update" && x.table?.toLowerCase() === table
    );
    if (updateIdx === -1) continue;

    const absUpdate = i + 1 + updateIdx;
    const setIdx    = stmts.slice(absUpdate + 1).findIndex(
      (x) => x.kind === "alter_set_not_null" && x.table?.toLowerCase() === table && x.column?.toLowerCase() === col
    );
    if (setIdx === -1) continue;

    const absSet = absUpdate + 1 + setIdx;
    workflows.push(`safe-add-not-null: ${s.table}.${s.column} (lines ${s.line}, ${stmts[absUpdate].line}, ${stmts[absSet].line})`);
    warnings.push({
      type: "safe-workflow", kind: "safe-add-not-null",
      message: `Safe 3-step NOT NULL pattern on ${s.table}.${s.column}: ADD nullable → backfill → SET NOT NULL.`,
      lines: [s.line, stmts[absUpdate].line, stmts[absSet].line],
      suggestion: "This is the recommended zero-downtime approach. The intermediate ADD_NOT_NULL warning is expected and can be suppressed.",
    });
  }
}

// ── Pattern 2: SET NOT NULL without a preceding backfill ──────────────────────

function detectBareSetNotNull(stmts: ParsedStatement[], warnings: SemanticWarning[]): void {
  for (const s of stmts) {
    if (s.kind !== "alter_set_not_null" || !s.table || !s.column) continue;
    const table = s.table.toLowerCase();
    const col   = s.column.toLowerCase();
    const hasBackfill = stmts.some(
      (x) => x.kind === "update" && x.table?.toLowerCase() === table && x.line < s.line
    );
    if (!hasBackfill) {
      warnings.push({
        type: "missing-step", kind: "bare-set-not-null",
        message: `SET NOT NULL on ${s.table}.${col} has no preceding UPDATE backfill in this migration.`,
        lines: [s.line],
        suggestion: `Add: UPDATE ${s.table} SET ${col} = <default> WHERE ${col} IS NULL  before SET NOT NULL.`,
      });
    }
  }
}

// ── Pattern 3: ADD COLUMN → UPDATE copy → DROP old column (safe rename) ──────

function detectSafeColumnRename(
  stmts: ParsedStatement[],
  warnings: SemanticWarning[],
  workflows: string[]
): void {
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    if (s.kind !== "alter_add_column" || !s.table) continue;
    const table = s.table.toLowerCase();

    const updateIdx = stmts.slice(i + 1).findIndex(
      (x) => x.kind === "update" && x.table?.toLowerCase() === table
    );
    if (updateIdx === -1) continue;

    const absUpdate = i + 1 + updateIdx;
    const dropIdx   = stmts.slice(absUpdate + 1).findIndex(
      (x) => x.kind === "alter_drop_column" && x.table?.toLowerCase() === table
    );
    if (dropIdx === -1) continue;

    const absDrop = absUpdate + 1 + dropIdx;
    workflows.push(`safe-column-rename: ${s.table} (lines ${s.line}, ${stmts[absUpdate].line}, ${stmts[absDrop].line})`);
    warnings.push({
      type: "safe-workflow", kind: "safe-column-rename",
      message: `Safe column rename on ${s.table}: ADD new → copy data → DROP old.`,
      lines: [s.line, stmts[absUpdate].line, stmts[absDrop].line],
      suggestion: "Ensure application code is updated before the DROP. Deploy in two phases if needed.",
    });
  }
}

// ── Pattern 4: DROP TABLE without a prior RENAME ─────────────────────────────

function detectDropWithoutRename(stmts: ParsedStatement[], warnings: SemanticWarning[]): void {
  for (const s of stmts) {
    if (s.kind !== "drop_table" || !s.table) continue;
    const table = s.table.toLowerCase();
    const hasRename = stmts.some(
      (x) => x.kind === "alter_rename_table" && x.table?.toLowerCase() === table && x.line < s.line
    );
    if (!hasRename) {
      warnings.push({
        type: "advisory", kind: "drop-without-rename",
        message: `DROP TABLE ${s.table} without a prior RENAME — data is unrecoverable without a backup.`,
        lines: [s.line],
        suggestion: `Consider: ALTER TABLE ${s.table} RENAME TO ${s.table}_deprecated first, then drop after confirming no references remain.`,
      });
    }
  }
}

// ── Pattern 5: ADD COLUMN new_type → UPDATE → DROP COLUMN old → RENAME new ───

function detectSafeColumnTypeChange(
  stmts: ParsedStatement[],
  warnings: SemanticWarning[],
  workflows: string[]
): void {
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    if (s.kind !== "alter_add_column" || !s.table || !s.column) continue;
    const table  = s.table.toLowerCase();
    const newCol = s.column.toLowerCase();

    const updateIdx = stmts.slice(i + 1).findIndex(
      (x) => x.kind === "update" && x.table?.toLowerCase() === table
    );
    if (updateIdx === -1) continue;

    const absUpdate = i + 1 + updateIdx;
    const renameIdx = stmts.slice(absUpdate + 1).findIndex(
      (x) => x.kind === "alter_rename_column" && x.table?.toLowerCase() === table && x.newName?.toLowerCase() === newCol
    );
    if (renameIdx === -1) continue;

    const absRename = absUpdate + 1 + renameIdx;
    workflows.push(`safe-column-type-change: ${s.table}.${s.column} (lines ${s.line}, ${stmts[absUpdate].line}, ${stmts[absRename].line})`);
    warnings.push({
      type: "safe-workflow", kind: "safe-column-type-change",
      message: `Safe type change on ${s.table}.${s.column}: ADD new type column → migrate data → rename.`,
      lines: [s.line, stmts[absUpdate].line, stmts[absRename].line],
      suggestion: "Preferred over ALTER COLUMN TYPE which causes a full table rewrite and exclusive lock.",
    });
  }
}

// ── Pattern 6: CREATE INDEX CONCURRENTLY (zero-downtime) ─────────────────────

function detectSafeIndexCreation(
  stmts: ParsedStatement[],
  warnings: SemanticWarning[],
  workflows: string[]
): void {
  for (const s of stmts) {
    if (s.kind !== "create_index") continue;
    if (s.isConcurrent) {
      workflows.push(`safe-index-creation: ${s.indexName ?? s.table ?? "index"} (line ${s.line})`);
      warnings.push({
        type: "safe-workflow", kind: "safe-index-creation",
        message: `CREATE INDEX CONCURRENTLY on ${s.table ?? "table"} — zero-downtime index build detected.`,
        lines: [s.line],
        suggestion: "Best practice confirmed. Note: cannot run inside an explicit transaction block.",
      });
    } else {
      warnings.push({
        type: "missing-step", kind: "missing-concurrent-index",
        message: `CREATE INDEX without CONCURRENTLY on ${s.table ?? "table"} blocks all writes for the build duration.`,
        lines: [s.line],
        suggestion: "Replace with CREATE INDEX CONCURRENTLY to build without downtime.",
      });
    }
  }
}

// ── Pattern 7: ADD CONSTRAINT FOREIGN KEY NOT VALID → VALIDATE ───────────────

function detectSafeFkAddition(
  stmts: ParsedStatement[],
  warnings: SemanticWarning[],
  workflows: string[]
): void {
  // Detect any ALTER TABLE ADD CONSTRAINT followed by VALIDATE CONSTRAINT on same table
  const addConstraints = stmts.filter((s) => s.kind === "alter_add_constraint" && s.table);
  for (const add of addConstraints) {
    const table = add.table!.toLowerCase();
    const hasValidate = stmts.some(
      (s) => s.kind === "alter_add_constraint" &&
             s.table?.toLowerCase() === table &&
             s.line > add.line
    );
    if (hasValidate) {
      workflows.push(`safe-fk-addition: ${add.table} (line ${add.line})`);
      warnings.push({
        type: "safe-workflow", kind: "safe-fk-addition",
        message: `Safe FK addition pattern on ${add.table}: ADD CONSTRAINT NOT VALID → VALIDATE CONSTRAINT.`,
        lines: [add.line],
        suggestion: "Optimal pattern: the NOT VALID form avoids scanning existing rows at add time.",
      });
    }
  }
}

// ── Pattern 8: Backfill pattern (UPDATE with no WHERE near an ALTER) ──────────

function detectBackfillPattern(
  stmts: ParsedStatement[],
  warnings: SemanticWarning[],
  workflows: string[]
): void {
  const updates = stmts.filter((s) => s.kind === "update" && s.hasWhere === false);
  for (const upd of updates) {
    if (!upd.table) continue;
    const table = upd.table.toLowerCase();
    const hasAlter = stmts.some(
      (s) =>
        (s.kind === "alter_add_column" || s.kind === "alter_set_not_null") &&
        s.table?.toLowerCase() === table
    );
    if (hasAlter) {
      workflows.push(`backfill-pattern: ${upd.table} (line ${upd.line})`);
      warnings.push({
        type: "safe-workflow", kind: "backfill-pattern",
        message: `Backfill UPDATE (no WHERE) detected on ${upd.table} as part of an ALTER TABLE workflow.`,
        lines: [upd.line],
        suggestion: "This is expected in a backfill migration. Ensure the UPDATE is intentional and runs in batches on large tables.",
      });
    }
  }
}
