import fs from "fs";
import path from "path";
import { CheckResult, ScanResult } from "../types";
import { checkStatement } from "./rules";
import { MigrasafeConfig } from "../config";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_STATEMENTS = 10_000;

function splitStatements(sql: string): { statement: string; line: number }[] {
  const results: { statement: string; line: number }[] = [];
  let current = "";
  let startLine = 1;
  let currentLine = 1;
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
      if (trimmed) results.push({ statement: trimmed, line: startLine });
      current = "";
      startLine = currentLine + (next === "\n" ? 1 : 0);
    } else {
      current += ch;
    }
  }

  const remaining = current.trim();
  if (remaining) results.push({ statement: remaining, line: startLine });

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

  const issues = statements.flatMap(({ statement, line }) =>
    checkStatement(statement, line, fileName, config.disableRules)
  );
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

  return sqlFiles.map((e) => checkFile(path.join(dirPath, e.name), config));
}

export function buildScanResult(results: CheckResult[]): ScanResult {
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
  };
}
