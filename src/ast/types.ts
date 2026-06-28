export type StatementKind =
  | "drop_table" | "drop_column" | "drop_database" | "drop_index"
  | "drop_schema" | "drop_sequence" | "drop_type" | "drop_domain"
  | "drop_aggregate" | "drop_function" | "drop_trigger" | "drop_view"
  | "drop_owned" | "drop_constraint"
  | "alter_add_column" | "alter_drop_column" | "alter_rename_table"
  | "alter_rename_column" | "alter_set_not_null" | "alter_drop_not_null"
  | "alter_alter_column_type" | "alter_set_default" | "alter_drop_default"
  | "alter_add_constraint" | "alter_drop_constraint"
  | "alter_disable_trigger" | "alter_enable_trigger" | "alter_system"
  | "create_table" | "create_index" | "create_view" | "create_function"
  | "create_trigger" | "create_materialized_view" | "create_sequence"
  | "create_schema" | "create_type" | "create_domain"
  | "delete" | "update" | "insert" | "select" | "truncate"
  | "reindex" | "vacuum" | "vacuum_full" | "cluster" | "analyze" | "lock_table"
  | "detach_partition" | "attach_partition"
  | "unknown";

export interface ColumnDef {
  name: string;
  dataType: string;
  nullable: boolean;
  hasDefault: boolean;
  defaultExpr?: string;
  hasVolatileDefault?: boolean;
}

export interface ParsedStatement {
  kind: StatementKind;
  table?: string;
  tables: string[];
  column?: string;
  newName?: string;
  newType?: string;
  hasUsing?: boolean;
  reindexScope?: string;
  constraintType?: string;
  isNotValid?: boolean;
  alterSystemAction?: string;
  columnDef?: ColumnDef;
  indexName?: string;
  constraintName?: string;
  isConcurrent: boolean;
  ifExists: boolean;
  isCascade: boolean;
  hasWhere: boolean;
  isTemporary: boolean;
  confidence: number;
  raw: string;
  line: number;
}
