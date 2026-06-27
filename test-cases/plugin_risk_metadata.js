/**
 * Test plugin: verifies that plugin rule lock/rollback/dataLoss metadata
 * flows through to the risk report in buildScanResult/computeRisk.
 *
 * Bug: buildScanResult() called computeRisk(allIssues) without extraRules,
 * so computeRisk could not find plugin rules by message-match lookup.
 * Lock/rollback/dataLoss fell back to defaults (none/easy/none) regardless
 * of what the plugin rule declared.
 *
 * Fix: buildScanResult(results, extraRules) now accepts and forwards the
 * plugin rules to computeRisk(allIssues, extraRules).
 *
 * Usage (run from project root after `npm run build`):
 *   node -e "
 *     const {checkFile, buildScanResult} = require('./dist/checker/checker');
 *     const {loadPluginRules} = require('./dist/plugins/loader');
 *     const cfg = {plugins: ['./test-cases/plugin_risk_metadata.js']};
 *     const pluginRules = loadPluginRules(cfg);
 *     const results = [checkFile('./test-cases/plugin_risk_metadata_input.sql', cfg)];
 *     const scan = buildScanResult(results, pluginRules);
 *     console.assert(scan.risk.maxLock === 'access-exclusive', 'lock');
 *     console.assert(scan.risk.maxRollback === 'irreversible', 'rollback');
 *     console.assert(scan.risk.maxDataLoss === 'certain', 'dataLoss');
 *     console.log('PASS: plugin risk metadata propagated correctly');
 *   "
 */
module.exports = [{
  id: "PLUGIN_DANGEROUS_REINDEX",
  severity: "HIGH",
  category: "performance",
  dialect: "postgresql",
  lock: "access-exclusive",
  rollback: "irreversible",
  dataLoss: "certain",
  pattern: /\bREINDEX\b/i,
  message: "REINDEX acquires access-exclusive lock — plugin risk metadata test.",
  suggestion: "Use REINDEX CONCURRENTLY instead.",
}];
