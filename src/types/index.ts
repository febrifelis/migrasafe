export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type LockType = "none" | "row-exclusive" | "share" | "access-exclusive";
export type RollbackDifficulty = "easy" | "hard" | "irreversible";
export type DataLossRisk = "none" | "possible" | "certain";

export interface Issue {
  ruleId: string;
  severity: Severity;
  file: string;
  line: number;
  statement: string;
  message: string;
  suggestion?: string | undefined;
}

export interface RiskReport {
  score: number;              // 0–100
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  maxLock: LockType;
  maxRollback: RollbackDifficulty;
  maxDataLoss: DataLossRisk;
  hasIrreversible: boolean;
  hasCertainDataLoss: boolean;
}

export interface CheckResult {
  file: string;
  issues: Issue[];
}

export interface ScanResult {
  results: CheckResult[];
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  safe: boolean;
  risk: RiskReport;
}
