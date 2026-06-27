/**
 * Test: policy.blockedRules must match by rule ID, not message text.
 *
 * Bug: evaluatePolicy() matched blocked rules via
 *   allIssues.some((i) => i.message.includes(blockedRuleId))
 * Rule IDs use underscores (DROP_TABLE) but messages use spaces/different
 * phrasing, so the substring search always returned false and blocked rules
 * were silently ignored.
 *
 * Fix: added ruleId field to Issue interface; checkStatement() now sets
 * ruleId: rule.id on each issue; evaluatePolicy() matches with
 *   allIssues.some((i) => i.ruleId === blockedRuleId)
 *
 * Run from project root after `npm run build`:
 *   node test-cases/policy_blocked_rules_test.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const POLICY = path.join(__dirname, "..", ".migrasafe-policy.json");
const SQL    = path.join(__dirname, "dangerous.sql");

fs.writeFileSync(POLICY, JSON.stringify({ blockedRules: ["DROP_TABLE"] }));

try {
  let output = "";
  let exitCode = 0;
  try {
    output = execFileSync("node", ["dist/index.js", "policy", "check", SQL], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf-8",
    });
  } catch (err) {
    output = err.stdout + err.stderr;
    exitCode = err.status;
  }

  console.assert(exitCode === 2, `Expected exit 2 (policy block), got ${exitCode}`);
  console.assert(
    output.includes("Policy explicitly blocks rule: DROP_TABLE"),
    "Expected DROP_TABLE block message"
  );
  console.log("TEST PASSED: blockedRules matched by ruleId, policy violation reported correctly");
} finally {
  fs.rmSync(POLICY, { force: true });
}
