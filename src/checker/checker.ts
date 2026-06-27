import fs from "fs";
import path from "path";
import { CheckResult, ScanResult } from "../types";
import { checkStatement } from "./rules";

function splitStatements(sql: string): { statement: string; line: number }[] {
  const results: { statement: string; line: number }[] = [];
  let current = "";
  let startLine = 1;
  let currentLine = 1;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "\n") {
      inLineComment = false;
      currentLine++;
    }

    if (inLineComment) {
      // skip line comment content
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      // skip block comment content
      continue;
    }

    if (ch === "-" && next === "-") {
      inLineComment = true;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      continue;
    }

    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) {
        results.push({ statement: trimmed, line: startLine });
      }
      current = "";
      startLine = currentLine + (next === "\n" ? 1 : 0);
    } else {
      current += ch;
    }
  }

  const remaining = current.trim();
  if (remaining) {
    results.push({ statement: remaining, line: startLine });
  }

  return results;
}

export function checkFile(filePath: string): CheckResult {
  const content = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath);
  const statements = splitStatements(content);
  const issues = statements.flatMap(({ statement, line }) =>
    checkStatement(statement, line, fileName)
  );
  return { file: filePath, issues };
}

export function checkDirectory(dirPath: string): CheckResult[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const sqlFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".sql"))
    .sort((a, b) => a.name.localeCompare(b.name));

  return sqlFiles.map((e) => checkFile(path.join(dirPath, e.name)));
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
