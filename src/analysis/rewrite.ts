import { ParsedStatement } from "../ast/types";

export type DowntimeEstimate =
  | "none"                  // no lock, online operation
  | "milliseconds"          // brief lock only, near-zero downtime
  | "seconds-to-minutes"    // depends on table size
  | "minutes-to-hours"      // table rewrite or large scan
  | "maintenance-window";   // requires taking DB offline or dedicated window

export interface RewriteAnalysis {
  isTableRewrite: boolean;
  affectedTable?: string;
  downtimeEstimate: DowntimeEstimate;
  downtimeReason: string;
  estimatedCostHint: string;
}

// Operations that cause a full table rewrite in PostgreSQL
const REWRITE_KINDS = new Set([
  "alter_alter_column_type",
  "vacuum_full",
  "cluster",
]);

// Operations that are online (no or minimal lock)
const ONLINE_KINDS = new Set([
  "create_index",   // only if CONCURRENTLY
  "reindex",        // only if CONCURRENTLY
  "analyze",
  "select",
  "insert",
  "create_view",
  "create_function",
  "create_trigger",
  "create_materialized_view",
]);

export function analyzeRewrite(stmt: ParsedStatement): RewriteAnalysis {
  const table = stmt.table;

  if (REWRITE_KINDS.has(stmt.kind)) {
    if (stmt.kind === "alter_alter_column_type") {
      return {
        isTableRewrite: true,
        affectedTable: table,
        downtimeEstimate: "minutes-to-hours",
        downtimeReason: "ALTER COLUMN TYPE rewrites the entire table — duration proportional to table size.",
        estimatedCostHint: "Full table rewrite: ~100MB/min on typical hardware. Add USING clause to cast in-place where possible.",
      };
    }
    if (stmt.kind === "vacuum_full") {
      return {
        isTableRewrite: true,
        affectedTable: table,
        downtimeEstimate: "minutes-to-hours",
        downtimeReason: "VACUUM FULL rewrites the table and holds an exclusive lock throughout.",
        estimatedCostHint: "Full table rewrite. Use pg_repack for online reclamation.",
      };
    }
    if (stmt.kind === "cluster") {
      return {
        isTableRewrite: true,
        affectedTable: table,
        downtimeEstimate: "minutes-to-hours",
        downtimeReason: "CLUSTER rewrites the table in index order with an exclusive lock.",
        estimatedCostHint: "Full table rewrite. Use pg_repack for online clustering.",
      };
    }
  }

  if (stmt.kind === "create_index") {
    if (stmt.isConcurrent) {
      return {
        isTableRewrite: false,
        affectedTable: table,
        downtimeEstimate: "none",
        downtimeReason: "CREATE INDEX CONCURRENTLY builds without blocking reads/writes.",
        estimatedCostHint: "~10–30 seconds per GB of indexed data. Runs in background.",
      };
    }
    return {
      isTableRewrite: false,
      affectedTable: table,
      downtimeEstimate: "seconds-to-minutes",
      downtimeReason: "CREATE INDEX without CONCURRENTLY holds a SHARE lock blocking writes.",
      estimatedCostHint: "~10–30 seconds per GB. Blocks writes. Use CONCURRENTLY to avoid.",
    };
  }

  if (stmt.kind === "reindex") {
    if (stmt.isConcurrent) {
      return {
        isTableRewrite: false,
        affectedTable: table,
        downtimeEstimate: "none",
        downtimeReason: "REINDEX CONCURRENTLY rebuilds the index without blocking.",
        estimatedCostHint: "Online rebuild — safe for production.",
      };
    }
    return {
      isTableRewrite: false,
      affectedTable: table,
      downtimeEstimate: "seconds-to-minutes",
      downtimeReason: "REINDEX without CONCURRENTLY holds an exclusive lock on the index.",
      estimatedCostHint: "Proportional to index size. Use CONCURRENTLY to avoid.",
    };
  }

  if (stmt.kind === "alter_add_column") {
    if (stmt.columnDef?.hasDefault) {
      // PG11+: ADD COLUMN with constant DEFAULT is instant (no rewrite)
      // PG10-: rewrites the table
      return {
        isTableRewrite: false,
        affectedTable: table,
        downtimeEstimate: "milliseconds",
        downtimeReason: "ADD COLUMN with DEFAULT is instant in PostgreSQL 11+ (metadata-only change).",
        estimatedCostHint: "PostgreSQL 11+: instant. PostgreSQL 10 or earlier: full table rewrite.",
      };
    }
    return {
      isTableRewrite: false,
      affectedTable: table,
      downtimeEstimate: "milliseconds",
      downtimeReason: "ADD COLUMN without DEFAULT is a metadata-only operation.",
      estimatedCostHint: "Instant — no data is written.",
    };
  }

  if (stmt.kind === "alter_set_not_null") {
    return {
      isTableRewrite: false,
      affectedTable: table,
      downtimeEstimate: "seconds-to-minutes",
      downtimeReason: "SET NOT NULL scans the entire table to validate existing rows.",
      estimatedCostHint: "Full table scan. On PostgreSQL 12+, use a CHECK CONSTRAINT NOT VALID first to avoid lock.",
    };
  }

  if (stmt.kind === "drop_table" || stmt.kind === "drop_column" || stmt.kind === "truncate") {
    return {
      isTableRewrite: false,
      affectedTable: table,
      downtimeEstimate: "milliseconds",
      downtimeReason: "DROP/TRUNCATE is instant but acquires ACCESS EXCLUSIVE lock briefly.",
      estimatedCostHint: "Lock duration: milliseconds. Data loss is immediate and permanent.",
    };
  }

  if (ONLINE_KINDS.has(stmt.kind)) {
    return {
      isTableRewrite: false,
      affectedTable: table,
      downtimeEstimate: "none",
      downtimeReason: "No lock or very brief lock.",
      estimatedCostHint: "Minimal impact.",
    };
  }

  return {
    isTableRewrite: false,
    affectedTable: table,
    downtimeEstimate: "milliseconds",
    downtimeReason: "Brief ACCESS EXCLUSIVE lock.",
    estimatedCostHint: "Impact depends on table size and concurrent traffic.",
  };
}

export function downtimeLabel(d: DowntimeEstimate): string {
  switch (d) {
    case "none":                return "none (online)";
    case "milliseconds":        return "< 1 second";
    case "seconds-to-minutes":  return "seconds to minutes (table-size dependent)";
    case "minutes-to-hours":    return "minutes to hours (full table rewrite)";
    case "maintenance-window":  return "requires maintenance window";
  }
}
