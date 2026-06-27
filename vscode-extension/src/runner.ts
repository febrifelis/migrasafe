import { execFile } from "child_process";
import * as path from "path";
import * as vscode from "vscode";

export interface JsonIssue {
  severity: string;
  line: number;
  statement: string;
  message: string;
  suggestion?: string;
}

export interface JsonFileResult {
  file: string;
  issueCount: number;
  issues: JsonIssue[];
}

export interface JsonScanResult {
  safe: boolean;
  summary: { critical: number; high: number; medium: number; total: number };
  risk: { score: number; level: string };
  files: JsonFileResult[];
}

function getMigrasafeBin(): string {
  const cfg = vscode.workspace.getConfiguration("migrasafe");
  return cfg.get<string>("executablePath") || "npx";
}

export function runMigrasafe(filePath: string): Promise<JsonScanResult> {
  return new Promise((resolve, reject) => {
    const cfg = vscode.workspace.getConfiguration("migrasafe");
    const dialect = cfg.get<string>("dialect", "auto");
    const minSeverity = cfg.get<string>("minSeverity", "MEDIUM");
    const bin = getMigrasafeBin();

    const args =
      bin === "npx"
        ? ["migrasafe", "check", filePath, "--format", "json", "--dialect", dialect, "--min-severity", minSeverity]
        : ["check", filePath, "--format", "json", "--dialect", dialect, "--min-severity", minSeverity];

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(filePath);

    execFile(bin, args, { cwd, timeout: 30_000 }, (err, stdout) => {
      if (!stdout) {
        return reject(new Error(err?.message ?? "No output from migrasafe"));
      }
      try {
        resolve(JSON.parse(stdout) as JsonScanResult);
      } catch {
        reject(new Error("Failed to parse migrasafe output"));
      }
    });
  });
}
