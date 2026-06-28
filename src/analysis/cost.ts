import { ParsedStatement, StatementKind } from "../ast/types";

export type RowsAffected  = "none" | "indexed" | "all" | "unknown";
export type MemoryUsage   = "low" | "medium" | "high";
export type ExecutionCost = "instant" | "fast" | "proportional" | "expensive";

export interface CostAnalysis {
  rowsAffected:    RowsAffected;
  isTableRewrite:  boolean;
  memoryUsage:     MemoryUsage;
  executionCost:   ExecutionCost;
  concurrentSafe:  boolean;
  score:           number;      // 0–100
  notes:           string[];
}

const INSTANT_KINDS = new Set<StatementKind>([
  "create_view", "create_function", "create_trigger", "create_sequence",
  "create_schema", "create_type", "create_domain",
  "drop_index", "drop_view", "drop_function", "drop_trigger", "drop_sequence",
  "drop_type", "drop_domain", "drop_aggregate", "drop_constraint",
  "alter_set_default", "alter_drop_default", "alter_enable_trigger",
  "alter_add_constraint", "alter_drop_constraint", "alter_drop_not_null",
]);

const PROPORTIONAL_KINDS = new Set<StatementKind>([
  "create_index", "reindex",
  "alter_set_not_null", "alter_add_column",
  "delete", "update", "analyze",
]);

const EXPENSIVE_KINDS = new Set<StatementKind>([
  "alter_alter_column_type", "vacuum_full", "cluster",
  "drop_table", "drop_schema", "drop_owned", "truncate",
]);

export function analyzeCost(stmt: ParsedStatement): CostAnalysis {
  if (stmt.kind === "create_index" || stmt.kind === "reindex") {
    const concurrent = stmt.isConcurrent;
    return {
      rowsAffected:   "indexed",
      isTableRewrite:  false,
      memoryUsage:    "medium",
      executionCost:  "proportional",
      concurrentSafe:  concurrent,
      score: concurrent ? 25 : 55,
      notes: [
        "Build time proportional to table data volume.",
        concurrent
          ? "CONCURRENTLY: two index scans required — roughly 2× the non-concurrent build time."
          : "Without CONCURRENTLY: blocks all writes for the entire build duration.",
        "Temporary disk space needed: roughly equal to the index size.",
      ],
    };
  }

  if (stmt.kind === "alter_alter_column_type" || stmt.kind === "vacuum_full" || stmt.kind === "cluster") {
    return {
      rowsAffected:   "all",
      isTableRewrite:  true,
      memoryUsage:    "high",
      executionCost:  "expensive",
      concurrentSafe:  false,
      score: 90,
      notes: [
        "Full table rewrite: reads every row and writes a new copy.",
        "Requires free disk space equal to the table size.",
        "Duration: ~100 MB/min on typical hardware — scales with table size.",
        "Exclusive lock held for the entire duration.",
      ],
    };
  }

  if (stmt.kind === "delete" || stmt.kind === "update") {
    if (!stmt.hasWhere) {
      return {
        rowsAffected:   "all",
        isTableRewrite:  false,
        memoryUsage:    "medium",
        executionCost:  "proportional",
        concurrentSafe:  false,
        score: 85,
        notes: [
          "No WHERE clause — every row in the table is affected.",
          "WAL generated for each row — high I/O on large tables.",
          "Autovacuum triggered afterward to reclaim dead tuple space.",
        ],
      };
    }
    return {
      rowsAffected:   "indexed",
      isTableRewrite:  false,
      memoryUsage:    "low",
      executionCost:  "fast",
      concurrentSafe:  true,
      score: 25,
      notes: ["Row-level locks only. Impact proportional to matched rows."],
    };
  }

  if (stmt.kind === "truncate") {
    return {
      rowsAffected:   "all",
      isTableRewrite:  false,
      memoryUsage:    "low",
      executionCost:  "instant",
      concurrentSafe:  false,
      score: 70,
      notes: [
        "TRUNCATE is a metadata operation — much faster than DELETE all rows.",
        "Does not fire row-level triggers.",
        "Requires ACCESS EXCLUSIVE lock — blocks all other access.",
      ],
    };
  }

  if (stmt.kind === "alter_set_not_null") {
    return {
      rowsAffected:   "all",
      isTableRewrite:  false,
      memoryUsage:    "low",
      executionCost:  "proportional",
      concurrentSafe:  false,
      score: 55,
      notes: [
        "Scans all rows to verify no NULLs — proportional to table size.",
        "PostgreSQL 12+: use a NOT VALID CHECK CONSTRAINT to defer the scan.",
      ],
    };
  }

  if (stmt.kind === "alter_add_column") {
    const hasDefault = stmt.columnDef?.hasDefault ?? false;
    return {
      rowsAffected:   hasDefault ? "all" : "none",
      isTableRewrite:  false,
      memoryUsage:    "low",
      executionCost:  hasDefault ? "instant" : "instant",
      concurrentSafe:  true,
      score: hasDefault ? 20 : 10,
      notes: hasDefault
        ? ["PostgreSQL 11+: constant DEFAULT is a metadata-only change (instant). PG 10 and below: full table rewrite."]
        : ["Metadata-only operation. No rows are touched."],
    };
  }

  if (INSTANT_KINDS.has(stmt.kind)) {
    return {
      rowsAffected:  "none",
      isTableRewrite: false,
      memoryUsage:   "low",
      executionCost: "instant",
      concurrentSafe: true,
      score: 10,
      notes: ["Metadata-only operation. No data movement."],
    };
  }

  if (EXPENSIVE_KINDS.has(stmt.kind)) {
    return {
      rowsAffected:  "all",
      isTableRewrite: (["alter_alter_column_type", "vacuum_full", "cluster"] as string[]).includes(stmt.kind),
      memoryUsage:   "high",
      executionCost: "expensive",
      concurrentSafe: false,
      score: 80,
      notes: ["High-cost operation. Plan during low-traffic window."],
    };
  }

  if (PROPORTIONAL_KINDS.has(stmt.kind)) {
    return {
      rowsAffected:  "all",
      isTableRewrite: false,
      memoryUsage:   "medium",
      executionCost: "proportional",
      concurrentSafe: false,
      score: 50,
      notes: ["Duration and cost proportional to table size."],
    };
  }

  return {
    rowsAffected:  "unknown",
    isTableRewrite: false,
    memoryUsage:   "low",
    executionCost: "fast",
    concurrentSafe: true,
    score: 15,
    notes: [],
  };
}
