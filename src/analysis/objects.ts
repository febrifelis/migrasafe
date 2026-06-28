import { ParsedStatement } from "../ast/types";

export interface AffectedObjects {
  categories: string[];   // human-readable categories: "views", "triggers", etc.
  details: string[];      // actionable detail lines
}

// Static advice on what dependent objects might be affected.
// (Cannot query the DB; this is structural reasoning only.)
export function analyzeAffectedObjects(stmt: ParsedStatement): AffectedObjects {
  const table = stmt.table ?? "the table";
  const col   = stmt.column ?? "the column";

  switch (stmt.kind) {
    case "drop_table":
      return {
        categories: ["views", "materialized views", "foreign keys", "triggers", "functions", "sequences"],
        details: [
          `Views or materialized views that SELECT from ${table} will become invalid.`,
          `Foreign keys from other tables referencing ${table} will be dropped (CASCADE) or block the operation.`,
          `Triggers defined on ${table} will be dropped automatically.`,
          `Functions or procedures that reference ${table} will fail at runtime.`,
          `Sequences owned by columns of ${table} will be dropped automatically.`,
        ],
      };

    case "drop_column":
      return {
        categories: ["views", "functions", "triggers", "indexes"],
        details: [
          `Views that reference ${col} on ${table} will become invalid.`,
          `Functions or procedures that reference ${table}.${col} will fail at runtime.`,
          `Triggers that reference ${col} in NEW/OLD will fail.`,
          `Indexes on ${col} will be dropped automatically.`,
        ],
      };

    case "alter_rename_table":
      return {
        categories: ["views", "functions", "triggers", "foreign keys", "application code"],
        details: [
          `All views referencing ${table} must be recreated with the new name.`,
          `Functions/procedures using ${table} will fail until updated.`,
          `Foreign keys referencing ${table} will update automatically on most databases.`,
          `Application queries using the old name ${table} will fail.`,
        ],
      };

    case "alter_rename_column":
      return {
        categories: ["views", "functions", "triggers", "indexes", "application code"],
        details: [
          `Views that reference ${col} on ${table} will become invalid.`,
          `Functions/procedures using ${table}.${col} must be updated.`,
          `Application queries selecting or filtering on ${col} will fail.`,
        ],
      };

    case "alter_alter_column_type":
      return {
        categories: ["views", "functions", "indexes", "foreign keys", "casts"],
        details: [
          `Views that use ${table}.${col} may fail if the new type is incompatible.`,
          `Indexes on ${col} will be rebuilt automatically (table rewrite or USING clause required).`,
          `Foreign keys that reference ${col} may fail if types become incompatible.`,
          `Functions using this column's type signature must be reviewed.`,
        ],
      };

    case "drop_schema":
      return {
        categories: ["all objects in schema"],
        details: [
          `All tables, views, sequences, functions, and types in this schema will be destroyed.`,
          `Foreign keys from other schemas referencing objects in this schema will fail or cascade.`,
        ],
      };

    case "drop_view":
      return {
        categories: ["dependent views", "functions", "materialized views"],
        details: [
          `Other views that depend on ${table} will become invalid (unless dropped with CASCADE).`,
          `Materialized views that reference ${table} will become invalid.`,
        ],
      };

    case "drop_sequence":
      return {
        categories: ["tables", "application code"],
        details: [
          `Columns that use ${table} as their DEFAULT will fail on INSERT.`,
          `Application code calling nextval('${table}') will fail.`,
        ],
      };

    case "drop_type":
      return {
        categories: ["tables", "functions", "views"],
        details: [
          `Table columns of this type will become invalid.`,
          `Functions that accept or return this type will fail.`,
          `Views using this type in expressions will fail.`,
        ],
      };

    case "alter_drop_constraint":
      return {
        categories: ["data integrity", "application assumptions"],
        details: [
          `Removing a constraint allows data that previously would have been rejected.`,
          `Application code that assumes constraint enforcement must add its own validation.`,
        ],
      };

    case "alter_disable_trigger":
      return {
        categories: ["data integrity", "audit trails"],
        details: [
          `Trigger-based validation is bypassed — dirty data may enter ${table}.`,
          `Audit logs or derived tables maintained by this trigger will not be updated.`,
          `Re-enable the trigger immediately after the data operation.`,
        ],
      };

    case "truncate":
      return {
        categories: ["triggers", "foreign keys"],
        details: [
          `TRUNCATE does NOT fire row-level triggers (only TRUNCATE triggers).`,
          `Tables with foreign keys referencing ${table} will fail unless CASCADE is used.`,
        ],
      };

    default:
      return { categories: [], details: [] };
  }
}
