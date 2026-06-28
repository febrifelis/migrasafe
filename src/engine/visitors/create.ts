import { registerVisitor } from "../visitor";

registerVisitor({
  id: "create-index-visitor",
  description: "Detects CREATE INDEX without CONCURRENTLY — blocks writes for the duration",
  kinds: ["create_index"],
  visit({ ast }) {
    if (ast.isConcurrent) return [];
    if (ast.isTemporary)  return [];
    const table = ast.table ? ` ON ${ast.table}` : "";
    return [{
      ruleId: "CREATE_INDEX_WITHOUT_CONCURRENT",
      severity: "MEDIUM",
      message: `CREATE INDEX${table} without CONCURRENTLY holds a SHARE lock blocking all writes for the build duration.`,
      suggestion: "Use CREATE INDEX CONCURRENTLY to build without blocking. Note: cannot run inside an explicit transaction block.",
      confidence: ast.confidence,
    }];
  },
});
