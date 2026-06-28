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
  suggestion?: string;
  // V3 fields
  confidence: number;
  affectedObjects: string[];
  estimatedDowntime?: string;
  isTableRewrite: boolean;
}

export interface RiskSubScores {
  lockScore:     number;
  rewriteScore:  number;
  rollbackScore: number;
  downtimeScore: number;
  dataLossScore: number;
}

export interface RiskReport {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  maxLock: LockType;
  maxRollback: RollbackDifficulty;
  maxDataLoss: DataLossRisk;
  hasIrreversible: boolean;
  hasCertainDataLoss: boolean;
  rewriteTables: string[];
  estimatedDowntime: string;
  subScores: RiskSubScores;
}

export interface CheckResult {
  file: string;
  issues: Issue[];
  parsedStatements?: import("../ast/types").ParsedStatement[];
}

export interface DependencyWarning {
  type: "safe-workflow" | "missing-step" | "advisory";
  kind: string;
  message: string;
  lines: number[];
  suggestion: string;
}

export interface ScanResult {
  results: CheckResult[];
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  safe: boolean;
  risk: RiskReport;
  dependencyWarnings: DependencyWarning[];
  workflows: string[];
}
