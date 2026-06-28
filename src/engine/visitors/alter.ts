import { registerVisitor } from "../visitor";

// PostgreSQL performs these type changes as metadata-only (catalog-only) — no table rewrite.
const PG_CATALOG_ONLY_TYPES = new Set(["TEXT", "CHARACTER VARYING", "VARCHAR"]);

registerVisitor({
  id: "alter-column-type-visitor",
  description: "Detects ALTER COLUMN TYPE which causes a full table rewrite",
  kinds: ["alter_alter_column_type"],
  visit({ ast, config }) {
    const col = ast.column ? `${ast.table}.${ast.column}` : ast.table ?? "column";
    const newType = (ast.newType ?? "").toUpperCase();
    const dialect = config.dialect ?? "auto";

    // VARCHAR/CHAR → TEXT in PostgreSQL is a catalog-only operation (no table rewrite).
    // Only skip if there's no USING clause (which would imply a non-trivial cast).
    if (
      (dialect === "postgresql" || dialect === "auto") &&
      PG_CATALOG_ONLY_TYPES.has(newType) &&
      !ast.hasUsing
    ) {
      return [];
    }

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
  id: "alter-add-column-visitor",
  description: "Detects ADD COLUMN risks: volatile DEFAULT (PG<14 rewrite) and NOT NULL without DEFAULT",
  kinds: ["alter_add_column"],
  visit({ ast, config }) {
    const def = ast.columnDef;
    if (!def) return [];
    const dialect = config.dialect ?? "auto";
    if (dialect === "mysql") return [];
    const col = ast.column ?? def.name ?? "column";
    const table = ast.table ?? "table";
    const issues = [];

    // ADD COLUMN GENERATED ALWAYS AS ... STORED — rewrites the whole table
    // to compute and persist the expression for every existing row
    if (/\bGENERATED\s+ALWAYS\s+AS\b[\s\S]*?\bSTORED\b/i.test(ast.raw ?? "")) {
      return [{
        ruleId: "ALTER_COLUMN_TYPE",
        severity: "HIGH",
        message: `ADD COLUMN ${table}.${col} GENERATED ALWAYS AS ... STORED rewrites the entire table — must compute the expression for every existing row.`,
        suggestion: "Add the column first as nullable without GENERATED, backfill the expression via UPDATE, then add the constraint in a later migration.",
        confidence: ast.confidence,
      }];
    }

    // ADD COLUMN with volatile DEFAULT — causes full table rewrite in PostgreSQL < 14
    // regardless of nullability (existing rows get the volatile value materialized)
    if (def.hasDefault && def.hasVolatileDefault) {
      issues.push({
        ruleId: "ALTER_COLUMN_TYPE",
        severity: "HIGH" as const,
        message: `ADD COLUMN ${table}.${col} with a volatile DEFAULT rewrites the entire table in PostgreSQL < 14.`,
        suggestion: "On PostgreSQL 14+: this is safe (instant). On PG 11–13: add as nullable first without DEFAULT, backfill with UPDATE, then SET DEFAULT separately.",
        confidence: ast.confidence,
      });
    }

    // ADD COLUMN NOT NULL without DEFAULT — will fail on non-empty tables (all existing rows violate constraint)
    if (!def.nullable && !def.hasDefault) {
      issues.push({
        ruleId: "ADD_NOT_NULL_WITHOUT_DEFAULT",
        severity: "HIGH" as const,
        message: `ADD COLUMN ${table}.${col} is NOT NULL without a DEFAULT — will fail on any non-empty table.`,
        suggestion: `Use 3 steps: (1) ADD COLUMN ${col} nullable, (2) UPDATE ${table} SET ${col} = <value> WHERE ${col} IS NULL, (3) ALTER COLUMN ${col} SET NOT NULL.`,
        confidence: ast.confidence,
      });
    }

    // Multi-clause ALTER: parser only captures the first ADD COLUMN clause.
    // Scan raw SQL for additional ADD COLUMN clauses with dangerous patterns.
    // Matches "ADD COLUMN name type ... DEFAULT func(" or "... NOT NULL" without DEFAULT.
    if (ast.raw) {
      // Skip past the first ADD COLUMN clause (find first comma at depth 0)
      let depth2 = 0;
      let firstCommaIdx = -1;
      for (let i = 0; i < ast.raw.length; i++) {
        if (ast.raw[i] === "(") depth2++;
        else if (ast.raw[i] === ")") depth2--;
        else if (ast.raw[i] === "," && depth2 === 0) { firstCommaIdx = i; break; }
      }
      if (firstCommaIdx !== -1) {
        const rest = ast.raw.slice(firstCommaIdx + 1);
        // Detect volatile DEFAULT in remaining clauses: function call pattern (word followed by '(')
        const volatileInRest = /\bDEFAULT\s+(?:[^,;(]*\w\s*\(|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|TRANSACTION_TIMESTAMP)/i.test(rest);
        // Detect NOT NULL without DEFAULT in remaining ADD COLUMN clauses
        const notNullNoDef = /\bADD\s+(?:COLUMN\s+)?\w+\s+\w[\w\s<>]*\bNOT\s+NULL\b(?![\s\S]*?\bDEFAULT\b)/i.test(rest);
        // Detect DROP COLUMN in remaining clauses
        const dropInRest = /\bDROP\s+COLUMN\b/i.test(rest);

        if (volatileInRest) {
          issues.push({
            ruleId: "ALTER_COLUMN_TYPE",
            severity: "HIGH" as const,
            message: `Multi-clause ALTER TABLE on ${table} contains a later ADD COLUMN with a volatile DEFAULT — rewrites table in PostgreSQL < 14.`,
            suggestion: "Split into separate ALTER TABLE statements. On PG 14+: safe. On PG 11–13: add nullable, backfill, then SET DEFAULT.",
            confidence: 0.7,
          });
        }
        if (notNullNoDef && !volatileInRest) {
          issues.push({
            ruleId: "ADD_NOT_NULL_WITHOUT_DEFAULT",
            severity: "HIGH" as const,
            message: `Multi-clause ALTER TABLE on ${table} contains a later ADD COLUMN NOT NULL without DEFAULT — will fail on non-empty tables.`,
            suggestion: "Use 3 steps: add nullable, backfill, then SET NOT NULL.",
            confidence: 0.65,
          });
        }
        if (dropInRest) {
          issues.push({
            ruleId: "DROP_COLUMN",
            severity: "CRITICAL" as const,
            message: `Multi-clause ALTER TABLE on ${table} contains a DROP COLUMN in a later clause — irreversible data loss.`,
            suggestion: "Separate DROP COLUMN into its own migration. Add the column back as nullable first, deprecate, then drop.",
            confidence: 0.7,
          });
        }
      }
    }

    return issues;
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
  id: "alter-add-constraint-visitor",
  description: "Detects ADD CONSTRAINT that scans the table under a heavy lock",
  kinds: ["alter_add_constraint"],
  visit({ ast }) {
    const ct = (ast.constraintType ?? "").toUpperCase();
    const table = ast.table ?? "table";
    const name = ast.constraintName ? ` ${ast.constraintName}` : "";

    if (ct === "PRIMARY") {
      return [{
        ruleId: "ADD_PRIMARY_KEY",
        severity: "HIGH",
        message: `ADD PRIMARY KEY${name} on ${table} acquires ACCESS EXCLUSIVE and validates every row — blocks all reads and writes.`,
        suggestion: "Create a UNIQUE index CONCURRENTLY first, then ADD CONSTRAINT ... PRIMARY KEY USING INDEX to make the promotion lock-free.",
        confidence: ast.confidence,
      }];
    }

    if (ct === "FOREIGN") {
      // NOT VALID skips the table scan — only acquires a brief ShareRowExclusiveLock
      if (ast.isNotValid) return [];
      return [{
        ruleId: "ADD_FOREIGN_KEY",
        severity: "HIGH",
        message: `ADD FOREIGN KEY${name} on ${table} scans the entire table to validate existing rows — long lock proportional to table size.`,
        suggestion: "Use ADD CONSTRAINT ... FOREIGN KEY ... NOT VALID to skip the scan, then VALIDATE CONSTRAINT in a separate step (uses ShareUpdateExclusiveLock).",
        confidence: ast.confidence,
      }];
    }

    return [];
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
    // RESET reverts to compiled-in default — still requires reload but much less risky
    if ((ast.alterSystemAction ?? "SET") === "RESET") {
      return [{
        ruleId: "ALTER_SYSTEM",
        severity: "MEDIUM",
        message: "ALTER SYSTEM RESET reverts a GUC to its default — requires pg_reload_conf() or a server restart to take effect.",
        suggestion: "Run SELECT pg_reload_conf() after this statement if the parameter supports online reload.",
        confidence: ast.confidence,
      }];
    }
    return [{
      ruleId: "ALTER_SYSTEM",
      severity: "CRITICAL",
      message: "ALTER SYSTEM SET modifies postgresql.conf — requires a server reload or restart to take effect.",
      suggestion: "Use pg_reload_conf() for non-restart parameters. Restart-required changes should be planned during a maintenance window.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "attach-partition-visitor",
  description: "Detects ALTER TABLE ATTACH PARTITION — acquires brief ACCESS EXCLUSIVE",
  kinds: ["attach_partition"],
  visit({ ast }) {
    const table = ast.table ?? "table";
    return [{
      ruleId: "ATTACH_PARTITION",
      severity: "MEDIUM",
      message: `ATTACH PARTITION on ${table} acquires a brief ACCESS EXCLUSIVE lock during the metadata update — blocks all traffic momentarily.`,
      suggestion: "Run during off-peak. Use ADD CONSTRAINT ... CHECK NOT VALID on the partition first so the lock phase is nearly instantaneous.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "detach-partition-visitor",
  description: "Detects DETACH PARTITION — concurrent vs non-concurrent lock differ significantly",
  kinds: ["detach_partition"],
  visit({ ast }) {
    const table = ast.table ?? "table";
    if (ast.isConcurrent) {
      return [{
        ruleId: "DETACH_PARTITION",
        severity: "MEDIUM",
        message: `DETACH PARTITION CONCURRENTLY on ${table} is non-blocking but still removes the partition from query routing — queries targeting the partition by name will fail.`,
        suggestion: "Ensure no application code directly references the detached partition before proceeding.",
        confidence: ast.confidence,
      }];
    }
    return [{
      ruleId: "DETACH_PARTITION",
      severity: "HIGH",
      message: `DETACH PARTITION on ${table} acquires ACCESS EXCLUSIVE — blocks all reads and writes for the duration. Use DETACH PARTITION ... CONCURRENTLY (PG 14+) for zero downtime.`,
      suggestion: "Upgrade to PostgreSQL 14+ and use DETACH PARTITION ... CONCURRENTLY to avoid locking.",
      confidence: ast.confidence,
    }];
  },
});
