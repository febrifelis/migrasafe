import fs from "fs";
import path from "path";
import {
  CheckResult, ScanResult, Issue, DependencyWarning,
} from "../types";
import { RULES, Rule } from "./rules";
import { MigrasafeConfig } from "../config";
import { loadPluginRules } from "../plugins/loader";
import { parseStatement } from "../ast/parser";
import { ParsedStatement } from "../ast/types";
import { analyzeSemantic } from "../analysis/semantic";
import { buildDependencyGraph } from "../analysis/graph";
import { runPipeline } from "../engine/pipeline";
import { computeEnhancedRisk } from "../engine/risk";

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

  // Parse all statements into AST nodes
  const parsed: ParsedStatement[] = statements.map(({ statement, line }) =>
    parseStatement(statement, line)
  );

  // Run pipeline (Visitors → Fallback Regex → Enrichment) per statement
  const issues = statements.flatMap(({ statement, line }, idx) => {
    const inlineIgnore = ignoreDirectives.get(line);
    if (inlineIgnore !== undefined && inlineIgnore.length === 0) return [];

    const effectiveDisable = [
      ...(config.disableRules ?? []),
      ...configRuleDisables,
      ...(inlineIgnore ?? []),
    ];

    return runPipeline(parsed[idx], statement, line, {
      dialect:          config.dialect ?? "auto",
      disableRules:     effectiveDisable,
      severityOverrides,
      pluginRules,
      config,
      allStatements:    parsed,
      file:             filePath,
    });
  });

  return { file: filePath, issues, parsedStatements: parsed };
}

export function checkDirectory(dirPath: string, config: MigrasafeConfig = {}): CheckResult[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const ignorePatterns = (config.ignore ?? []).flatMap((p) => {
    try { return [new RegExp(p)]; } catch { process.stderr.write(`Warning: invalid ignore pattern skipped: ${p}\n`); return []; }
  });

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

export function computeRisk(issues: Issue[], extraRules: Rule[] = [], parsedStatements: ParsedStatement[] = []) {
  return computeEnhancedRisk(issues, parsedStatements, extraRules);
}

export function buildScanResult(
  results: CheckResult[],
  extraRules: Rule[] = [],
  parsedStatements?: ParsedStatement[][]
): ScanResult {
  const allIssues    = results.flatMap((r) => r.issues);
  const criticalCount = allIssues.filter((i) => i.severity === "CRITICAL").length;
  const highCount     = allIssues.filter((i) => i.severity === "HIGH").length;
  const mediumCount   = allIssues.filter((i) => i.severity === "MEDIUM").length;

  // Collect parsedStatements from CheckResults if not passed explicitly
  const allParsed = parsedStatements?.flat() ?? results.flatMap((r) => r.parsedStatements ?? []);

  // Semantic analysis replaces the old dependency analysis
  const semantic = analyzeSemantic(allParsed);

  // Build dependency graph (available in risk engine)
  buildDependencyGraph(allParsed);

  const dependencyWarnings: DependencyWarning[] = semantic.warnings.map((w) => ({
    type:       w.type,
    kind:       w.kind,
    message:    w.message,
    lines:      w.lines,
    suggestion: w.suggestion,
  }));

  return {
    results,
    totalIssues: allIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    safe: criticalCount === 0 && highCount === 0,
    risk: computeEnhancedRisk(allIssues, allParsed, extraRules),
    dependencyWarnings,
    workflows: semantic.workflows,
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
