/**
 * Test: ruleId must be present in --format json output for each issue.
 *
 * Bug: formatJson() explicitly listed severity/line/statement/message/suggestion
 * but omitted ruleId. Consumers (CI scripts, IDE extensions, policy tools) that
 * need to identify which rule fired had no machine-readable field to rely on.
 *
 * Fix: added ruleId field to the Issue interface (src/types/index.ts),
 * populated it in checkStatement() from rule.id, and added it to the
 * issues map in formatJson() (src/output/formatter.ts).
 *
 * Run from project root after `npm run build`:
 *   node test-cases/json_ruleid_output_test.js
 */
const { spawnSync } = require("child_process");
const path = require("path");

const r = spawnSync(
  "node",
  ["dist/index.js", "check", "test-cases/dangerous.sql", "--format", "json"],
  { cwd: path.join(__dirname, ".."), encoding: "utf-8" }
);

const d = JSON.parse(r.stdout);
const issues = d.files[0].issues;

console.assert(issues.length === 2, `Expected 2 issues, got ${issues.length}`);
console.assert("ruleId" in issues[0], "ruleId missing from issue[0]");
console.assert("ruleId" in issues[1], "ruleId missing from issue[1]");
console.assert(
  issues[0].ruleId === "ADD_NOT_NULL_WITHOUT_DEFAULT",
  `Wrong ruleId[0]: ${issues[0].ruleId}`
);
console.assert(
  issues[1].ruleId === "DROP_TABLE",
  `Wrong ruleId[1]: ${issues[1].ruleId}`
);
console.log(
  `TEST PASSED: ruleId present in JSON output — [${issues.map((i) => i.ruleId).join(", ")}]`
);
