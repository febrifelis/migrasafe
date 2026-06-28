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

const HISTORY_MAX_BYTES = 50 * 1024 * 1024; // 50 MB guard
const HISTORY_MAX_ENTRIES = 10_000;

export function loadHistory(cwd: string = process.cwd()): HistoryEntry[] {
  const filePath = path.join(cwd, HISTORY_FILE);
  if (!fs.existsSync(filePath)) return [];
  const stat = fs.statSync(filePath);
  if (stat.size > HISTORY_MAX_BYTES) {
    process.stderr.write(`Warning: history file exceeds 50 MB — reading last ${HISTORY_MAX_ENTRIES} entries only\n`);
  }
  const lines = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "").split("\n").filter(Boolean);
  const entries = lines
    .map((l) => {
      try { return JSON.parse(l) as HistoryEntry; } catch { return null; }
    })
    .filter((e): e is HistoryEntry => e !== null);
  // Return only the most recent entries to avoid OOM on very large history
  return entries.length > HISTORY_MAX_ENTRIES ? entries.slice(-HISTORY_MAX_ENTRIES) : entries;
}
