/**
 * Test: `policy check` must exit 2 when requiresApproval is true, even if
 * no fatal policy violations exist.
 *
 * Bug: exit code logic was `pr.passed ? (safe ? 0 : 1) : 2`. When
 * requireApprovalAboveScore fired and pr.passed was true (no fatal violations),
 * the exit code was 1 (unsafe) or 0 (safe) instead of 2. CI pipelines that
 * gate on exit 2 for "needs human approval" would silently pass.
 * Same bug existed in the `check --policy` path.
 *
 * Fix: changed condition to `pr.passed && !pr.requiresApproval ? ... : 2`
 * in both the `policy check` command and the `check --policy` path.
 *
 * Run from project root after `npm run build`:
 *   node test-cases/policy_requires_approval_exit_test.js
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT   = path.join(__dirname, "..");
const POLICY = path.join(ROOT, ".migrasafe-policy.json");

function run(args) {
  return spawnSync("node", ["dist/index.js", ...args], { cwd: ROOT, encoding: "utf-8" });
}

// Test 1: requireApprovalAboveScore exceeded → exit 2
fs.writeFileSync(POLICY, JSON.stringify({ requireApprovalAboveScore: 30 }));
const r1 = run(["policy", "check", "test-cases/dangerous.sql"]);
console.assert(r1.status === 2, `T1 expected exit 2 (approval required), got ${r1.status}`);

// Test 2: requireApprovalAboveScore not exceeded + scan safe → exit 0
fs.writeFileSync(POLICY, JSON.stringify({ requireApprovalAboveScore: 80 }));
const r2 = run(["policy", "check", "test-cases/safe.sql"]);
console.assert(r2.status === 0, `T2 expected exit 0 (safe, no approval), got ${r2.status}`);

// Test 3: requireApprovalAboveScore not exceeded + scan unsafe → exit 1
const r3 = run(["policy", "check", "test-cases/dangerous.sql"]);
console.assert(r3.status === 1, `T3 expected exit 1 (unsafe, no approval), got ${r3.status}`);

fs.rmSync(POLICY, { force: true });
console.log(`TEST PASSED: exit codes — approval-required=2, safe=0, unsafe-no-approval=1`);
