export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface Issue {
  severity: Severity;
  file: string;
  line: number;
  statement: string;
  message: string;
  suggestion?: string | undefined;
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
}
