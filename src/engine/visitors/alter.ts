import { registerVisitor } from "../visitor";

registerVisitor({
  id: "alter-column-type-visitor",
  description: "Detects ALTER COLUMN TYPE which causes a full table rewrite",
  kinds: ["alter_alter_column_type"],
  visit({ ast }) {
    const col = ast.column ? `${ast.table}.${ast.column}` : ast.table ?? "column";
    return [{
      ruleId: "ALTER_COLUMN_TYPE",
      severity: "HIGH",
      message: `ALTER COLUMN TYPE on ${col} rewrites the entire table — long lock, proportional to table size.`,
      suggestion: "Add a new column with the new type, backfill data, update application references, then drop the old column.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "alter-set-not-null-visitor",
  description: "Detects SET NOT NULL which scans the full table to validate existing rows",
  kinds: ["alter_set_not_null"],
  visit({ ast, allStatements }) {
    const col   = ast.column ?? "column";
    const table = ast.table  ?? "table";

    // Suppress if a safe 3-step workflow is already in place (ADD + backfill + SET NOT NULL)
    const hasBackfill = allStatements.some(
      (s) => s.kind === "update" && s.table?.toLowerCase() === table.toLowerCase() && s.line < ast.line
    );
    if (hasBackfill) return [];

    return [{
      ruleId: "ALTER_COLUMN_SET_NOT_NULL",
      severity: "HIGH",
      message: `SET NOT NULL on ${table}.${col} without a preceding backfill — existing NULL rows will cause a constraint violation.`,
      suggestion: `Run: UPDATE ${table} SET ${col} = <default> WHERE ${col} IS NULL  before applying SET NOT NULL.`,
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "alter-rename-table-visitor",
  description: "Detects RENAME TABLE which breaks all references to the old name",
  kinds: ["alter_rename_table"],
  visit({ ast }) {
    const from = ast.table   ?? "table";
    const to   = ast.newName ?? "new_name";
    return [{
      ruleId: "RENAME_TABLE",
      severity: "HIGH",
      message: `RENAME TABLE ${from} → ${to} breaks all views, functions, and application queries referencing the old name.`,
      suggestion: "Create a compatibility view under the old name, update all references, then drop the view in a later migration.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "alter-rename-column-visitor",
  description: "Detects RENAME COLUMN which breaks application queries using the old name",
  kinds: ["alter_rename_column"],
  visit({ ast }) {
    const col  = ast.column  ?? "column";
    const to   = ast.newName ?? "new_name";
    const table = ast.table  ?? "table";
    return [{
      ruleId: "RENAME_COLUMN",
      severity: "HIGH",
      message: `RENAME COLUMN ${table}.${col} → ${to} breaks all queries, views, and functions using the old column name.`,
      suggestion: "Add the new column, copy data, update application code, then drop the old column in a separate migration.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "alter-disable-trigger-visitor",
  description: "Detects DISABLE TRIGGER which bypasses data integrity enforcement",
  kinds: ["alter_disable_trigger"],
  visit({ ast }) {
    return [{
      ruleId: "DISABLE_TRIGGER",
      severity: "HIGH",
      message: `DISABLE TRIGGER bypasses validation and audit logic on ${ast.table ?? "the table"} — dirty data may enter the database.`,
      suggestion: "Re-enable the trigger immediately after the data operation. Document the reason for disabling.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "alter-drop-constraint-visitor",
  description: "Detects DROP CONSTRAINT which removes data integrity guarantees",
  kinds: ["alter_drop_constraint"],
  visit({ ast }) {
    const constraint = ast.constraintName ? ` ${ast.constraintName}` : "";
    return [{
      ruleId: "DROP_CONSTRAINT",
      severity: "MEDIUM",
      message: `DROP CONSTRAINT${constraint} removes a data integrity rule — previously rejected data may now be accepted.`,
      suggestion: "Verify the constraint is no longer needed. Document why it is being removed.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "alter-system-visitor",
  description: "Detects ALTER SYSTEM which modifies server-level configuration",
  kinds: ["alter_system"],
  visit({ ast }) {
    return [{
      ruleId: "ALTER_SYSTEM",
      severity: "CRITICAL",
      message: "ALTER SYSTEM modifies postgresql.conf — requires a server reload or restart to take effect.",
      suggestion: "Use pg_reload_conf() for non-restart parameters. Restart-required changes should be planned during a maintenance window.",
      confidence: ast.confidence,
    }];
  },
});
