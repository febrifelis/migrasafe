import { registerVisitor } from "../visitor";

registerVisitor({
  id: "vacuum-full-visitor",
  description: "Detects VACUUM FULL which rewrites the entire table with an exclusive lock",
  kinds: ["vacuum_full"],
  visit({ ast }) {
    const table = ast.table ? ` ${ast.table}` : "";
    return [{
      ruleId: "VACUUM_FULL",
      severity: "HIGH",
      message: `VACUUM FULL${table} rewrites the entire table and holds an ACCESS EXCLUSIVE lock — database is unavailable during operation.`,
      suggestion: "Use pg_repack to reclaim space online without locking. VACUUM (without FULL) reclaims dead tuples safely.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "reindex-visitor",
  description: "Detects REINDEX without CONCURRENTLY — locks the index exclusively",
  kinds: ["reindex"],
  visit({ ast }) {
    if (ast.isConcurrent) return [];
    const target = ast.indexName ?? ast.table ?? "index";
    return [{
      ruleId: "REINDEX_WITHOUT_CONCURRENT",
      severity: "MEDIUM",
      message: `REINDEX ${target} without CONCURRENTLY holds an exclusive lock — reads and writes on indexed table are blocked.`,
      suggestion: "Use REINDEX CONCURRENTLY (PostgreSQL 12+) to rebuild the index without blocking.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "cluster-visitor",
  description: "Detects CLUSTER which rewrites the table in index order with an exclusive lock",
  kinds: ["cluster"],
  visit({ ast }) {
    const table = ast.table ? ` ${ast.table}` : "";
    return [{
      ruleId: "CLUSTER",
      severity: "HIGH",
      message: `CLUSTER${table} rewrites the entire table in index order and holds an ACCESS EXCLUSIVE lock throughout.`,
      suggestion: "Use pg_repack for online clustering. Schedule during a maintenance window if CLUSTER is required.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "lock-table-visitor",
  description: "Detects explicit LOCK TABLE statements",
  kinds: ["lock_table"],
  visit({ ast }) {
    const table = ast.table ?? ast.tables[0] ?? "table";
    return [{
      ruleId: "LOCK_TABLE",
      severity: "HIGH",
      message: `LOCK TABLE ${table} acquires an explicit lock — may block concurrent operations indefinitely if not released promptly.`,
      suggestion: "Ensure the lock is always released. Use lock_timeout to prevent indefinite blocking: SET lock_timeout = '5s'.",
      confidence: ast.confidence,
    }];
  },
});
