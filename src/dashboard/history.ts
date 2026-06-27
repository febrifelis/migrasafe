import fs from "fs";
import path from "path";
import { ScanResult } from "../types";

export interface HistoryEntry {
  timestamp: string;
  version: string;
  target: string;
  safe: boolean;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  totalIssues: number;
  riskScore: number;
  riskLevel: string;
  files: number;
}

const HISTORY_FILE = ".migrasafe-history.ndjson";

export function appendHistory(
  result: ScanResult,
  target: string,
  version: string,
  cwd: string = process.cwd()
): void {
  const entry: HistoryEntry = {
    timestamp: new Date().toISOString(),
    version,
    target,
    safe: result.safe,
    criticalCount: result.criticalCount,
    highCount: result.highCount,
    mediumCount: result.mediumCount,
    totalIssues: result.totalIssues,
    riskScore: result.risk.score,
    riskLevel: result.risk.level,
    files: result.results.length,
  };
  const filePath = path.join(cwd, HISTORY_FILE);
  fs.appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
}

export function loadHistory(cwd: string = process.cwd()): HistoryEntry[] {
  const filePath = path.join(cwd, HISTORY_FILE);
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  return lines
    .map((l) => {
      try { return JSON.parse(l) as HistoryEntry; } catch { return null; }
    })
    .filter((e): e is HistoryEntry => e !== null);
}
