import { registerVisitor } from "../visitor";

registerVisitor({
  id: "drop-table-visitor",
  description: "Detects DROP TABLE statements that permanently destroy data",
  kinds: ["drop_table"],
  visit({ ast, config }) {
    const dialect = config.dialect ?? "auto";
    if (dialect === "mysql") return []; // handled by mysql-specific rule if needed
    return [{
      ruleId: "DROP_TABLE",
      severity: "CRITICAL",
      message: "DROP TABLE permanently destroys data and dependent objects.",
      suggestion: "Rename the table first (RENAME TO <name>_deprecated), verify nothing references it, then drop in a later migration.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "drop-column-visitor",
  description: "Detects DROP COLUMN which causes irreversible data loss",
  kinds: ["alter_drop_column"],
  visit({ ast }) {
    const col = ast.column ? ` (${ast.table}.${ast.column})` : "";
    return [{
      ruleId: "DROP_COLUMN",
      severity: "CRITICAL",
      message: `DROP COLUMN${col} is irreversible — data cannot be recovered without a backup.`,
      suggestion: "Add the column back as nullable first. Deprecate in application code. Drop only after all references are removed.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "drop-database-visitor",
  description: "Detects DROP DATABASE — catastrophic data loss",
  kinds: ["drop_database"],
  visit({ ast }) {
    return [{
      ruleId: "DROP_DATABASE",
      severity: "CRITICAL",
      message: "DROP DATABASE destroys the entire database and all its objects.",
      suggestion: "Verify this is intentional. Ensure a recent backup exists before proceeding.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "drop-index-visitor",
  description: "Detects DROP INDEX which may degrade query performance",
  kinds: ["drop_index"],
  visit({ ast }) {
    // DROP INDEX CONCURRENTLY is non-blocking — only the performance impact remains,
    // which is below the threshold for flagging (index name often implies it's obsolete).
    if (ast.isConcurrent) return [];
    const idx = ast.indexName ? ` ${ast.indexName}` : "";
    return [{
      ruleId: "DROP_INDEX",
      severity: "MEDIUM",
      message: `DROP INDEX${idx} removes a query optimization — affected queries may degrade significantly.`,
      suggestion: "Verify no critical queries rely on this index. Use EXPLAIN ANALYZE to confirm before dropping. Use DROP INDEX CONCURRENTLY to avoid a table lock.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "drop-schema-visitor",
  description: "Detects DROP SCHEMA which destroys all objects in the schema",
  kinds: ["drop_schema"],
  visit({ ast }) {
    return [{
      ruleId: "DROP_SCHEMA",
      severity: "CRITICAL",
      message: "DROP SCHEMA destroys all tables, views, functions, and other objects in the schema.",
      suggestion: "Ensure CASCADE is intentional. Document which objects will be removed.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "drop-function-visitor",
  description: "Detects DROP FUNCTION/PROCEDURE which breaks all callers at runtime",
  kinds: ["drop_function"],
  visit({ ast }) {
    return [{
      ruleId: "DROP_FUNCTION",
      severity: "HIGH",
      message: "DROP FUNCTION removes the function — all callers will error at runtime with 'function does not exist'.",
      suggestion: "Create a replacement function first. Deprecate callers. Drop only after all references are removed.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "drop-view-visitor",
  description: "Detects DROP VIEW which breaks all queries and reports depending on it",
  kinds: ["drop_view"],
  visit({ ast }) {
    const view = ast.table ?? "view";
    return [{
      ruleId: "DROP_VIEW",
      severity: "HIGH",
      message: `DROP VIEW ${view} breaks all queries, reports, and application code that reference this view.`,
      suggestion: "Create a replacement view first. Deprecate the old view name in application code. Drop only after all references are removed.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "drop-owned-visitor",
  description: "Detects DROP OWNED BY which removes all objects owned by a role",
  kinds: ["drop_owned"],
  visit({ ast }) {
    return [{
      ruleId: "DROP_OWNED",
      severity: "CRITICAL",
      message: "DROP OWNED BY removes all database objects owned by the specified role(s).",
      suggestion: "List the owned objects first with \\d before executing this statement.",
      confidence: ast.confidence,
    }];
  },
});
