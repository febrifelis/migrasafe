import fs from "fs";
import path from "path";
import {
  CheckResult, ScanResult, Issue, RiskReport,
  LockType, RollbackDifficulty, DataLossRisk, DependencyWarning,
} from "../types";
import { checkStatement, RULES, Rule } from "./rules";
import { MigrasafeConfig } from "../config";
import { loadPluginRules } from "../plugins/loader";
import { parseStatement } from "../ast/parser";
import { ParsedStatement } from "../ast/types";
import { analyzeDependencies } from "../analysis/dependency";
import { analyzeRewrite, downtimeLabel } from "../analysis/rewrite";
import { analyzeAffectedObjects } from "../analysis/objects";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_STATEMENTS = 10_000;

function parseIgnoreDirectives(content: string): Map<number, string[]> {
  const directives = new Map<number, string[]>();
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/--\s*migrasafe-disable-next-line\s*(.*)/i);
    if (match) {
      const rulesPart = match[1].trim();
      const rules = rulesPart ? rulesPart.split(/[\s,]+/).filter(Boolean) : [];
      directives.set(i + 2, rules);
    }
  }
  return directives;
}

function splitStatements(sql: string): { statement: string; line: number }[] {
  const results: { statement: string; line: number }[] = [];
  let current = "";
  let currentLine = 1;
  let firstCharLine = -1;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag = "";
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "\n") { inLineComment = false; currentLine++; }

    if (!inLineComment && !inBlockComment && !inSingleQuote && !inDoubleQuote) {
      if (!inDollarQuote && ch === "$") {
        const rest = sql.slice(i);
        const match = rest.match(/^\$([^$]*)\$/);
        if (match) {
          dollarTag = match[0]; current += dollarTag; i += dollarTag.length - 1;
          inDollarQuote = true; continue;
        }
      }
      if (inDollarQuote) {
        const rest = sql.slice(i);
        if (rest.startsWith(dollarTag)) {
          current += dollarTag; i += dollarTag.length - 1; inDollarQuote = false; dollarTag = "";
        } else { current += ch; }
        continue;
      }
    }

    if (inDollarQuote) { current += ch; continue; }

    if (!inLineComment && !inBlockComment && !inDoubleQuote) {
      if (ch === "'" && !inSingleQuote) { inSingleQuote = true; current += ch; continue; }
      if (inSingleQuote) {
        current += ch;
        if (ch === "'" && next === "'") { current += next; i++; }
        else if (ch === "'") { inSingleQuote = false; }
        continue;
      }
    }

    if (!inLineComment && !inBlockComment && !inSingleQuote) {
      if (ch === '"' && !inDoubleQuote) { inDoubleQuote = true; current += ch; continue; }
      if (inDoubleQuote) { current += ch; if (ch === '"') { inDoubleQuote = false; } continue; }
    }

    if (inLineComment) continue;
    if (inBlockComment) { if (ch === "*" && next === "/") { inBlockComment = false; i++; } continue; }
    if (ch === "-" && next === "-") { inLineComment = true; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; continue; }

    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) results.push({ statement: trimmed, line: firstCharLine !== -1 ? firstCharLine : currentLine });
      current = ""; firstCharLine = -1;
    } else {
      if (firstCharLine === -1 && ch.trim() !== "") firstCharLine = currentLine;
      current += ch;
    }
  }

  const remaining = current.trim();
  if (remaining) results.push({ statement: remaining, line: firstCharLine !== -1 ? firstCharLine : currentLine });
  return results;
}

export function checkFile(filePath: string, config: MigrasafeConfig = {}): CheckResult {
  const stat = fs.statSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(`Skipping symlink: ${filePath}`);
  if (stat.size > MAX_FILE_SIZE_BYTES) throw new Error(
    `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB > 10 MB limit): ${filePath}`
  );

  const raw = fs.readFileSync(filePath, "utf-8");
  if (raw.includes("\0")) throw new Error(`Binary file skipped: ${filePath}`);

  const content = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^﻿/, "");
  const fileName = path.basename(filePath);
  const statements = splitStatements(content);

  if (statements.length > MAX_STATEMENTS) throw new Error(
    `Too many statements (${statements.length} > ${MAX_STATEMENTS} limit): ${filePath}`
  );

  const ignoreDirectives = parseIgnoreDirectives(content);

  const severityOverrides: Record<string, import("../types").Severity> = {};
  const configRuleDisables: string[] = [];
  for (const [id, opts] of Object.entries(config.rules ?? {})) {
    if (opts.disabled) configRuleDisables.push(id);
    if (opts.severity) severityOverrides[id] = opts.severity;
  }

  const pluginRules = loadPluginRules(config);

  // V3: Parse all statements into AST nodes first
  const parsed: ParsedStatement[] = statements.map(({ statement, line }) =>
    parseStatement(statement, line)
  );

  const issues = statements.flatMap(({ statement, line }, idx) => {
    const inlineIgnore = ignoreDirectives.get(line);
    if (inlineIgnore !== undefined && inlineIgnore.length === 0) return [];
    const effectiveDisable = [
      ...(config.disableRules ?? []),
      ...configRuleDisables,
      ...(inlineIgnore ?? []),
    ];

    const rawIssues = checkStatement(
      statement, line, fileName, effectiveDisable,
      severityOverrides, config.dialect ?? "auto", pluginRules
    );

    // V3: Enrich each issue with AST-derived metadata
    const ast = parsed[idx];
    return rawIssues.map((issue) => enrichIssue(issue, ast, pluginRules));
  });

  return { file: filePath, issues };
}

function enrichIssue(issue: Issue, ast: ParsedStatement, extraRules: Rule[]): Issue {
  const ruleMap = new Map([...RULES, ...extraRules].map((r) => [r.id, r]));
  const rule = ruleMap.get(issue.ruleId);

  // Confidence: from rule definition; boosted if AST parse was high-confidence
  const ruleConf = rule?.confidence ?? 0.85;
  const confidence = Math.min(1.0, ruleConf * (0.8 + ast.confidence * 0.2));

  // Affected objects from AST
  const objAnalysis = analyzeAffectedObjects(ast);
  const affectedObjects = objAnalysis.categories;

  // Estimated downtime and rewrite detection from AST
  const rewrite = analyzeRewrite(ast);
  const estimatedDowntime = downtimeLabel(rewrite.downtimeEstimate);
  const isTableRewrite = rewrite.isTableRewrite;

  return {
    ...issue,
    confidence: Math.round(confidence * 100) / 100,
    affectedObjects,
    estimatedDowntime,
    isTableRewrite,
  };
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

const LOCK_ORDER: LockType[]             = ["none", "row-exclusive", "share", "access-exclusive"];
const ROLLBACK_ORDER: RollbackDifficulty[] = ["easy", "hard", "irreversible"];
const DATALOSS_ORDER: DataLossRisk[]     = ["none", "possible", "certain"];

function maxOf<T>(order: T[], values: T[]): T {
  return values.reduce((best, v) => order.indexOf(v) > order.indexOf(best) ? v : best, order[0]);
}

export function computeRisk(issues: Issue[], extraRules: Rule[] = []): RiskReport {
  if (issues.length === 0) {
    return {
      score: 0, level: "LOW",
      maxLock: "none", maxRollback: "easy", maxDataLoss: "none",
      hasIrreversible: false, hasCertainDataLoss: false,
      rewriteTables: [], estimatedDowntime: "none (online)",
    };
  }

  const ruleMap = new Map([...RULES, ...extraRules].map((r) => [r.id, r]));
  const locks: LockType[] = [];
  const rollbacks: RollbackDifficulty[] = [];
  const dataLosses: DataLossRisk[] = [];
  const rewriteTables: string[] = [];

  let score = 0;
  for (const issue of issues) {
    if (issue.severity === "CRITICAL") score += 30;
    else if (issue.severity === "HIGH")   score += 15;
    else if (issue.severity === "MEDIUM") score += 5;

    const rule = ruleMap.get(issue.ruleId);
    if (rule) {
      locks.push(rule.lock);
      rollbacks.push(rule.rollback);
      dataLosses.push(rule.dataLoss);
    }

    if (issue.isTableRewrite) {
      const tbl = issue.statement.match(/\bON\s+(\w+)\b|\bTABLE\s+(\w+)\b/i);
      const name = tbl?.[1] ?? tbl?.[2] ?? "unknown";
      if (!rewriteTables.includes(name)) rewriteTables.push(name);
    }
  }

  score = Math.min(100, score);

  const maxLock     = maxOf(LOCK_ORDER,     locks.length     ? locks     : (["none"] as LockType[]));
  const maxRollback = maxOf(ROLLBACK_ORDER, rollbacks.length ? rollbacks : (["easy"] as RollbackDifficulty[]));
  const maxDataLoss = maxOf(DATALOSS_ORDER, dataLosses.length ? dataLosses : (["none"] as DataLossRisk[]));
  const hasIrreversible    = maxRollback === "irreversible";
  const hasCertainDataLoss = maxDataLoss === "certain";

  if (hasCertainDataLoss) score = Math.max(score, 60);
  if (hasIrreversible)    score = Math.max(score, 50);

  const level: RiskReport["level"] =
    score >= 60 ? "CRITICAL" : score >= 40 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";

  // Worst-case downtime across all rewrite issues
  const downtimes = issues.map((i) => i.estimatedDowntime ?? "< 1 second");
  const order = ["none (online)", "< 1 second", "seconds to minutes (table-size dependent)", "minutes to hours (full table rewrite)", "requires maintenance window"];
  const estimatedDowntime = downtimes.reduce(
    (best, d) => order.indexOf(d) > order.indexOf(best) ? d : best,
    "none (online)"
  );

  return { score, level, maxLock, maxRollback, maxDataLoss, hasIrreversible, hasCertainDataLoss, rewriteTables, estimatedDowntime };
}

export function buildScanResult(
  results: CheckResult[],
  extraRules: Rule[] = [],
  parsedStatements?: ParsedStatement[][]
): ScanResult {
  const allIssues = results.flatMap((r) => r.issues);
  const criticalCount = allIssues.filter((i) => i.severity === "CRITICAL").length;
  const highCount     = allIssues.filter((i) => i.severity === "HIGH").length;
  const mediumCount   = allIssues.filter((i) => i.severity === "MEDIUM").length;

  // V3: Run dependency analysis across all parsed statements
  let dependencyWarnings: DependencyWarning[] = [];
  let workflows: string[] = [];

  if (parsedStatements) {
    const allParsed = parsedStatements.flat();
    const depResult = analyzeDependencies(allParsed);
    dependencyWarnings = depResult.warnings;
    workflows = depResult.workflows;
  }

  return {
    results,
    totalIssues: allIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    safe: criticalCount === 0 && highCount === 0,
    risk: computeRisk(allIssues, extraRules),
    dependencyWarnings,
    workflows,
  };
}

// V3: Parse all statements in a file and return them (for dependency analysis)
export function parseFileStatements(filePath: string): ParsedStatement[] {
  try {
    const raw = fs.readFileSync(filePath, "utf-8")
      .replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^﻿/, "");
    return splitStatements(raw).map(({ statement, line }) => parseStatement(statement, line));
  } catch {
    return [];
  }
}
