import fs from "fs";
import path from "path";
import { CheckResult, ScanResult, Issue, RiskReport, LockType, RollbackDifficulty, DataLossRisk } from "../types";
import { checkStatement, RULES, Rule } from "./rules";
import { MigrasafeConfig } from "../config";
import { loadPluginRules } from "../plugins/loader";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_STATEMENTS = 10_000;

// Returns a map of lineNumber -> ruleIds[] to disable on that line.
// Empty array = disable ALL rules. Specific IDs = disable only those rules.
// Supports:
//   -- migrasafe-disable-next-line          (disable all rules on next statement)
//   -- migrasafe-disable-next-line RULE_ID  (disable specific rule on next statement)
//   -- migrasafe-disable-next-line R1 R2    (disable multiple rules)
function parseIgnoreDirectives(content: string): Map<number, string[]> {
  const directives = new Map<number, string[]>();
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/--\s*migrasafe-disable-next-line\s*(.*)/i);
    if (match) {
      const rulesPart = match[1].trim();
      const rules = rulesPart ? rulesPart.split(/[\s,]+/).filter(Boolean) : [];
      // line numbers are 1-based; directive on line i+1 applies to line i+2
      directives.set(i + 2, rules);
    }
  }
  return directives;
}

function splitStatements(sql: string): { statement: string; line: number }[] {
  const results: { statement: string; line: number }[] = [];
  let current = "";
  let startLine = 1;
  let currentLine = 1;
  let firstCharLine = -1; // line of first real char added to current statement
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag = "";
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "\n") {
      inLineComment = false;
      currentLine++;
    }

    // --- dollar-quoted strings (PostgreSQL) ---
    if (!inLineComment && !inBlockComment && !inSingleQuote && !inDoubleQuote) {
      if (!inDollarQuote && ch === "$") {
        const rest = sql.slice(i);
        const match = rest.match(/^\$([^$]*)\$/);
        if (match) {
          dollarTag = match[0];
          current += dollarTag;
          i += dollarTag.length - 1;
          inDollarQuote = true;
          continue;
        }
      }
      if (inDollarQuote) {
        const rest = sql.slice(i);
        if (rest.startsWith(dollarTag)) {
          current += dollarTag;
          i += dollarTag.length - 1;
          inDollarQuote = false;
          dollarTag = "";
        } else {
          current += ch;
        }
        continue;
      }
    }

    if (inDollarQuote) { current += ch; continue; }

    // --- single-quoted strings ---
    if (!inLineComment && !inBlockComment && !inDoubleQuote) {
      if (ch === "'" && !inSingleQuote) { inSingleQuote = true; current += ch; continue; }
      if (inSingleQuote) {
        current += ch;
        // handle escaped quote ''
        if (ch === "'" && next === "'") { current += next; i++; }
        else if (ch === "'") { inSingleQuote = false; }
        continue;
      }
    }

    // --- double-quoted identifiers ---
    if (!inLineComment && !inBlockComment && !inSingleQuote) {
      if (ch === '"' && !inDoubleQuote) { inDoubleQuote = true; current += ch; continue; }
      if (inDoubleQuote) {
        current += ch;
        if (ch === '"') { inDoubleQuote = false; }
        continue;
      }
    }

    if (inLineComment) continue;

    if (inBlockComment) {
      if (ch === "*" && next === "/") { inBlockComment = false; i++; }
      continue;
    }

    if (ch === "-" && next === "-") { inLineComment = true; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; continue; }

    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) results.push({ statement: trimmed, line: firstCharLine !== -1 ? firstCharLine : startLine });
      current = "";
      firstCharLine = -1;
      startLine = currentLine + (next === "\n" ? 1 : 0);
    } else {
      // First real (non-comment, non-whitespace) char of this statement
      if (firstCharLine === -1 && ch.trim() !== "") firstCharLine = currentLine;
      current += ch;
    }
  }

  const remaining = current.trim();
  if (remaining) results.push({ statement: remaining, line: firstCharLine !== -1 ? firstCharLine : startLine });

  return results;
}

export function checkFile(filePath: string, config: MigrasafeConfig = {}): CheckResult {
  const stat = fs.statSync(filePath);

  // Guard: skip symlinks
  if (stat.isSymbolicLink()) {
    throw new Error(`Skipping symlink: ${filePath}`);
  }

  // Guard: file size limit
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB > 10 MB limit): ${filePath}`
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  // Guard: binary file detection (null bytes)
  if (raw.includes("\0")) {
    throw new Error(`Binary file skipped: ${filePath}`);
  }

  const content = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^﻿/, "");
  const fileName = path.basename(filePath);
  const statements = splitStatements(content);

  // Guard: max statement count
  if (statements.length > MAX_STATEMENTS) {
    throw new Error(
      `Too many statements (${statements.length} > ${MAX_STATEMENTS} limit): ${filePath}`
    );
  }

  const ignoreDirectives = parseIgnoreDirectives(content);

  // Build severity overrides and per-rule disables from config.rules
  const severityOverrides: Record<string, import("../types").Severity> = {};
  const configRuleDisables: string[] = [];
  for (const [id, opts] of Object.entries(config.rules ?? {})) {
    if (opts.disabled) configRuleDisables.push(id);
    if (opts.severity) severityOverrides[id] = opts.severity;
  }

  const pluginRules = loadPluginRules(config);

  const issues = statements.flatMap(({ statement, line }) => {
    const inlineIgnore = ignoreDirectives.get(line);
    if (inlineIgnore !== undefined && inlineIgnore.length === 0) return [];
    const effectiveDisable = [
      ...(config.disableRules ?? []),
      ...configRuleDisables,
      ...(inlineIgnore ?? []),
    ];
    return checkStatement(statement, line, fileName, effectiveDisable, severityOverrides, config.dialect ?? "auto", pluginRules);
  });
  return { file: filePath, issues };
}

export function checkDirectory(dirPath: string, config: MigrasafeConfig = {}): CheckResult[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const ignorePatterns = (config.ignore ?? []).map((p) => new RegExp(p));

  const sqlFiles = entries
    .filter((e) => {
      if (!e.isFile() || e.isSymbolicLink()) return false;
      if (!e.name.toLowerCase().endsWith(".sql")) return false;
      const filePath = path.join(dirPath, e.name);
      return !ignorePatterns.some((re) => re.test(filePath));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const results: CheckResult[] = [];
  for (const e of sqlFiles) {
    try {
      results.push(checkFile(path.join(dirPath, e.name), config));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Warning: skipped ${e.name} — ${msg}\n`);
    }
  }
  return results;
}

const LOCK_ORDER: LockType[] = ["none", "row-exclusive", "share", "access-exclusive"];
const ROLLBACK_ORDER: RollbackDifficulty[] = ["easy", "hard", "irreversible"];
const DATALOSS_ORDER: DataLossRisk[] = ["none", "possible", "certain"];

function maxOf<T>(order: T[], values: T[]): T {
  return values.reduce((best, v) =>
    order.indexOf(v) > order.indexOf(best) ? v : best, order[0]);
}

export function computeRisk(issues: Issue[], extraRules: Rule[] = []): RiskReport {
  if (issues.length === 0) {
    return { score: 0, level: "LOW", maxLock: "none" as LockType, maxRollback: "easy" as RollbackDifficulty, maxDataLoss: "none" as DataLossRisk, hasIrreversible: false, hasCertainDataLoss: false };
  }

  // Look up rule metadata for each issue
  const ruleMap = new Map([...RULES, ...extraRules].map((r) => [r.id, r]));
  const locks: LockType[] = [];
  const rollbacks: RollbackDifficulty[] = [];
  const dataLosses: DataLossRisk[] = [];

  let score = 0;
  for (const issue of issues) {
    if (issue.severity === "CRITICAL") score += 30;
    else if (issue.severity === "HIGH") score += 15;
    else if (issue.severity === "MEDIUM") score += 5;

    // Find the rule by matching message (issues don't carry rule id, match by message)
    const rule = [...ruleMap.values()].find((r) => r.message === issue.message);
    if (rule) {
      locks.push(rule.lock);
      rollbacks.push(rule.rollback);
      dataLosses.push(rule.dataLoss);
    }
  }

  score = Math.min(100, score);

  const maxLock = maxOf(LOCK_ORDER, locks.length ? locks : ["none" as LockType]);
  const maxRollback = maxOf(ROLLBACK_ORDER, rollbacks.length ? rollbacks : ["easy" as RollbackDifficulty]);
  const maxDataLoss = maxOf(DATALOSS_ORDER, dataLosses.length ? dataLosses : ["none" as DataLossRisk]);
  const hasIrreversible = maxRollback === "irreversible";
  const hasCertainDataLoss = maxDataLoss === "certain";

  // Minimum score bumps for critical risk properties
  if (hasCertainDataLoss) score = Math.max(score, 60);
  if (hasIrreversible)    score = Math.max(score, 50);

  const level: RiskReport["level"] =
    score >= 60 ? "CRITICAL" :
    score >= 40 ? "HIGH" :
    score >= 20 ? "MEDIUM" : "LOW";

  return { score, level, maxLock, maxRollback, maxDataLoss, hasIrreversible, hasCertainDataLoss };
}

export function buildScanResult(results: CheckResult[], extraRules: Rule[] = []): ScanResult {
  const allIssues = results.flatMap((r) => r.issues);
  const criticalCount = allIssues.filter((i) => i.severity === "CRITICAL").length;
  const highCount = allIssues.filter((i) => i.severity === "HIGH").length;
  const mediumCount = allIssues.filter((i) => i.severity === "MEDIUM").length;

  return {
    results,
    totalIssues: allIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    safe: criticalCount === 0 && highCount === 0,
    risk: computeRisk(allIssues, extraRules),
  };
}
