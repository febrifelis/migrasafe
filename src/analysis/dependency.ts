import { ParsedStatement } from "../ast/types";

export type WorkflowKind =
  | "safe-add-not-null"
  | "safe-column-rename"
  | "bare-set-not-null"
  | "drop-without-rename";

export interface DependencyWarning {
  type: "safe-workflow" | "missing-step" | "advisory";
  kind: WorkflowKind;
  message: string;
  lines: number[];
  suggestion: string;
}

export interface DependencyResult {
  warnings: DependencyWarning[];
  workflows: string[];
}

export function analyzeDependencies(stmts: ParsedStatement[]): DependencyResult {
  const warnings: DependencyWarning[] = [];
  const workflows: string[] = [];

  detectSafeAddNotNull(stmts, warnings, workflows);
  detectBareSetNotNull(stmts, warnings);
  detectSafeColumnRename(stmts, warnings, workflows);
  detectDropWithoutRename(stmts, warnings);

  return { warnings, workflows };
}

// Detect: ADD COLUMN nullable → UPDATE (backfill) → SET NOT NULL
// When present, it's a SAFE workflow — suppress the ADD_NOT_NULL warning advisory.
function detectSafeAddNotNull(
  stmts: ParsedStatement[],
  warnings: DependencyWarning[],
  workflows: string[]
): void {
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    if (s.kind !== "alter_add_column" || !s.columnDef?.nullable || !s.table || !s.column) continue;

    const table = s.table.toLowerCase();
    const col   = s.column.toLowerCase();

    // Look ahead for UPDATE on same table (backfill) then SET NOT NULL on same column
    const updateIdx = stmts.slice(i + 1).findIndex(
      (x) => x.kind === "update" && x.table?.toLowerCase() === table
    );
    if (updateIdx === -1) continue;

    const absUpdateIdx = i + 1 + updateIdx;
    const setNotNullIdx = stmts.slice(absUpdateIdx + 1).findIndex(
      (x) => x.kind === "alter_set_not_null" && x.table?.toLowerCase() === table && x.column?.toLowerCase() === col
    );
    if (setNotNullIdx === -1) continue;

    const absSetIdx = absUpdateIdx + 1 + setNotNullIdx;
    workflows.push(`safe-add-not-null: ${s.table}.${s.column} (lines ${s.line}, ${stmts[absUpdateIdx].line}, ${stmts[absSetIdx].line})`);
    warnings.push({
      type: "safe-workflow",
      kind: "safe-add-not-null",
      message: `Safe 3-step NOT NULL pattern detected for ${s.table}.${s.column}: ADD nullable → backfill → SET NOT NULL.`,
      lines: [s.line, stmts[absUpdateIdx].line, stmts[absSetIdx].line],
      suggestion: "This is the recommended approach. The ADD_NOT_NULL_WITHOUT_DEFAULT warning on the intermediate step is expected.",
    });
  }
}

// Detect: SET NOT NULL without a preceding UPDATE backfill in the same migration
function detectBareSetNotNull(stmts: ParsedStatement[], warnings: DependencyWarning[]): void {
  for (const s of stmts) {
    if (s.kind !== "alter_set_not_null" || !s.table || !s.column) continue;

    const table = s.table.toLowerCase();
    const col   = s.column.toLowerCase();

    const hasBackfill = stmts.some(
      (x) => x.kind === "update" && x.table?.toLowerCase() === table && x.line < s.line
    );
    if (!hasBackfill) {
      warnings.push({
        type: "missing-step",
        kind: "bare-set-not-null",
        message: `SET NOT NULL on ${s.table}.${col} has no preceding UPDATE backfill in this migration.`,
        lines: [s.line],
        suggestion: `Add UPDATE ${s.table} SET ${col} = <default> WHERE ${col} IS NULL before SET NOT NULL.`,
      });
    }
  }
}

// Detect: ADD COLUMN → UPDATE → DROP COLUMN (safe rename pattern)
function detectSafeColumnRename(
  stmts: ParsedStatement[],
  warnings: DependencyWarning[],
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

    const absUpdateIdx = i + 1 + updateIdx;
    const dropIdx = stmts.slice(absUpdateIdx + 1).findIndex(
      (x) => x.kind === "alter_drop_column" && x.table?.toLowerCase() === table
    );
    if (dropIdx === -1) continue;

    const absDropIdx = absUpdateIdx + 1 + dropIdx;
    workflows.push(`safe-column-rename: ${s.table} (lines ${s.line}, ${stmts[absUpdateIdx].line}, ${stmts[absDropIdx].line})`);
    warnings.push({
      type: "safe-workflow",
      kind: "safe-column-rename",
      message: `Safe column rename pattern detected on ${s.table}: ADD new column → copy data → DROP old column.`,
      lines: [s.line, stmts[absUpdateIdx].line, stmts[absDropIdx].line],
      suggestion: "This is the zero-downtime rename approach. Ensure application code is updated before the DROP.",
    });
  }
}

// Detect: DROP TABLE without a prior RENAME in the same migration
function detectDropWithoutRename(stmts: ParsedStatement[], warnings: DependencyWarning[]): void {
  for (const s of stmts) {
    if (s.kind !== "drop_table" || !s.table) continue;

    const table = s.table.toLowerCase();
    const hasRename = stmts.some(
      (x) => x.kind === "alter_rename_table" && x.table?.toLowerCase() === table && x.line < s.line
    );
    if (!hasRename) {
      warnings.push({
        type: "advisory",
        kind: "drop-without-rename",
        message: `DROP TABLE ${s.table} has no preceding RENAME in this migration — data is unrecoverable without a backup.`,
        lines: [s.line],
        suggestion: `Consider: ALTER TABLE ${s.table} RENAME TO ${s.table}_deprecated_$(date +%Y%m%d) in a prior migration, then drop after confirming nothing references it.`,
      });
    }
  }
}
