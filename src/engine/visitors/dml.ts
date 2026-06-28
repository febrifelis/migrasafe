import { registerVisitor } from "../visitor";

registerVisitor({
  id: "delete-without-where-visitor",
  description: "Detects DELETE without WHERE clause — deletes all rows",
  kinds: ["delete"],
  visit({ ast }) {
    if (ast.hasWhere) return [];
    const table = ast.table ?? ast.tables[0] ?? "table";
    return [{
      ruleId: "DELETE_WITHOUT_WHERE",
      severity: "CRITICAL",
      message: `DELETE FROM ${table} without WHERE deletes every row — this is almost certainly unintentional.`,
      suggestion: "Add a WHERE clause. To clear all rows use TRUNCATE (faster and explicit). To confirm intent add WHERE 1=1.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "update-without-where-visitor",
  description: "Detects UPDATE without WHERE clause — updates all rows",
  kinds: ["update"],
  visit({ ast }) {
    if (ast.hasWhere) return [];
    const table = ast.table ?? ast.tables[0] ?? "table";
    return [{
      ruleId: "UPDATE_WITHOUT_WHERE",
      severity: "CRITICAL",
      message: `UPDATE ${table} without WHERE overwrites every row — likely unintentional.`,
      suggestion: "Add a WHERE clause. If all rows must be updated, use WHERE 1=1 to make intent explicit.",
      confidence: ast.confidence,
    }];
  },
});

registerVisitor({
  id: "truncate-visitor",
  description: "Detects TRUNCATE which immediately deletes all rows without triggering row-level triggers",
  kinds: ["truncate"],
  visit({ ast }) {
    const table = ast.table ?? ast.tables[0] ?? "table";
    return [{
      ruleId: "TRUNCATE",
      severity: "CRITICAL",
      message: `TRUNCATE ${table} immediately removes all rows and bypasses row-level triggers — no row-by-row rollback.`,
      suggestion: "Ensure this is the intended operation. Test in a transaction that can be rolled back: BEGIN; TRUNCATE; (verify); ROLLBACK or COMMIT.",
      confidence: ast.confidence,
    }];
  },
});
