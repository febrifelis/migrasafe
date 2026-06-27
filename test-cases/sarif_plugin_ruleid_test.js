/**
 * Test: SARIF output must use issue.ruleId for plugin rules, not severity fallback.
 *
 * Bug: formatSarif() resolved rule IDs by doing a message-text lookup in the
 * built-in RULES map. Plugin rules are not in that map, so the lookup returned
 * undefined and fell back to issue.severity (e.g. "HIGH"), producing invalid
 * SARIF where ruleId was a severity string instead of the actual rule ID.
 *
 * Fix: issues now carry ruleId (added in previous fix). formatSarif() now reads
 * issue.ruleId directly instead of performing the fragile message-text search.
 *
 * Run from project root after `npm run build`:
 *   node test-cases/sarif_plugin_ruleid_test.js
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const POLICY = path.join(__dirname, "..", ".migrasaferc.json");
fs.writeFileSync(POLICY, JSON.stringify({ plugins: ["./test-cases/plugin_risk_metadata.js"] }));

try {
  const r = spawnSync(
    "node",
    ["dist/index.js", "check", "test-cases/plugin_risk_metadata_input.sql", "--format", "sarif"],
    { cwd: path.join(__dirname, ".."), encoding: "utf-8" }
  );

  const d = JSON.parse(r.stdout);
  const results = d.runs[0].results;

  const pluginResult = results.find((r) => r.ruleId === "PLUGIN_DANGEROUS_REINDEX");
  console.assert(pluginResult !== undefined, "Plugin rule ruleId not found in SARIF — got: " + results.map((r) => r.ruleId).join(", "));
  console.assert(pluginResult.level === "error", "Plugin HIGH rule should map to SARIF level=error, got: " + pluginResult?.level);
  console.log("TEST PASSED: plugin rule ruleId correctly set in SARIF output — ruleId=" + pluginResult.ruleId);
} finally {
  fs.rmSync(POLICY, { force: true });
}
