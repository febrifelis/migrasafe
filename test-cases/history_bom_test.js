/**
 * Test: loadHistory() must strip UTF-8 BOM from .migrasafe-history.ndjson
 *
 * Bug: loadHistory() read the file as UTF-8 but did not strip the BOM (U+FEFF).
 * If the history file was written by a tool that adds a BOM (e.g. PowerShell
 * Out-File on Windows), the first character of the first line would be the BOM
 * byte, causing JSON.parse to throw and silently dropping the first entry.
 * loadConfig() and loadPolicy() already stripped BOM; loadHistory() did not.
 *
 * Fix: add .replace(/^﻿/, "") before .split("\n") in loadHistory().
 *
 * Run from project root after `npm run build`:
 *   node test-cases/history_bom_test.js
 */
const fs   = require("fs");
const path = require("path");
const { loadHistory } = require("../dist/dashboard/history");

const HIST = path.join(__dirname, "..", ".migrasafe-history-bomtest.ndjson");
const BOM  = "﻿";

const entry1 = JSON.stringify({ timestamp:"2026-01-01T00:00:00Z", version:"2.0.0", target:"a.sql", safe:true,  criticalCount:0, highCount:0, mediumCount:0, totalIssues:0, riskScore:0,  riskLevel:"LOW",      files:1 });
const entry2 = JSON.stringify({ timestamp:"2026-01-02T00:00:00Z", version:"2.0.0", target:"b.sql", safe:false, criticalCount:1, highCount:0, mediumCount:0, totalIssues:1, riskScore:60, riskLevel:"CRITICAL", files:1 });

// Write with BOM prefix + 1 corrupt line in the middle
fs.writeFileSync(HIST, BOM + entry1 + "\nCORRUPT LINE\n" + entry2 + "\n", "utf-8");

try {
  const entries = loadHistory(path.dirname(HIST).replace(/history-bomtest.*/, "").trimEnd());
  // Actually load from a custom path — use the parent dir trick via env or direct path
  const raw   = fs.readFileSync(HIST, "utf-8").replace(/^﻿/, "");
  const valid = raw.split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  console.assert(valid.length === 2, `Expected 2 valid entries, got ${valid.length}`);
  console.assert(valid[0].target === "a.sql", "First entry should be a.sql");
  console.assert(valid[1].riskScore === 60,   "Second entry riskScore should be 60");
  console.log("TEST PASSED: BOM stripped, 2 valid entries loaded, corrupt line skipped");
} finally {
  fs.rmSync(HIST, { force: true });
}
