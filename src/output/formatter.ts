import chalk from "chalk";
import path from "path";
import { ScanResult, Severity, RiskReport } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SEVERITY_COLOR: Record<Severity, any> = {
  CRITICAL: chalk.bgRed.white.bold,
  HIGH: chalk.red.bold,
  MEDIUM: chalk.yellow.bold,
  LOW: chalk.blue,
  INFO: chalk.gray,
};

const SEVERITY_ICON: Record<Severity, string> = {
  CRITICAL: "✖ CRITICAL",
  HIGH: "⚠ HIGH    ",
  MEDIUM: "● MEDIUM  ",
  LOW: "○ LOW     ",
  INFO: "· INFO    ",
};

const LOCK_LABEL: Record<string, string> = {
  "none":             "none",
  "row-exclusive":    "ROW EXCLUSIVE (allows reads, blocks conflicting writes)",
  "share":            "SHARE (blocks writes, allows reads)",
  "access-exclusive": "ACCESS EXCLUSIVE (blocks all reads and writes)",
};

const ROLLBACK_LABEL: Record<string, string> = {
  "easy":        "easy — can be rolled back in a transaction",
  "hard":        "hard — requires manual steps or data restore",
  "irreversible":"irreversible — requires backup restore",
};

const DATALOSS_LABEL: Record<string, string> = {
  "none":    "none",
  "possible":"possible",
  "certain": "CERTAIN",
};

function riskLevelColor(level: RiskReport["level"]): string {
  if (level === "CRITICAL") return chalk.bgRed.white.bold(` CRITICAL `);
  if (level === "HIGH")     return chalk.red.bold(level);
  if (level === "MEDIUM")   return chalk.yellow.bold(level);
  return chalk.green(level);
}

export function formatText(result: ScanResult): string {
  const lines: string[] = [];
  const filesScanned = result.results.length;

  lines.push("");
  lines.push(chalk.bold(`Scanning ${filesScanned} file(s)...\n`));

  let hasIssues = false;

  for (const fileResult of result.results) {
    if (fileResult.issues.length === 0) continue;
    hasIssues = true;

    lines.push(chalk.underline(path.relative(process.cwd(), fileResult.file)));

    for (const issue of fileResult.issues) {
      const color = SEVERITY_COLOR[issue.severity];
      const icon = SEVERITY_ICON[issue.severity];
      lines.push(`  ${color(icon)}  Line ${issue.line}`);
      lines.push(`  ${chalk.dim("Statement:")} ${chalk.white(issue.statement)}`);
      lines.push(`  ${chalk.dim("Problem  :")} ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`  ${chalk.dim("Fix      :")} ${chalk.cyan(issue.suggestion)}`);
      }
      lines.push("");
    }
  }

  if (!hasIssues) {
    lines.push(chalk.green("✔ All migrations are safe — no issues found.\n"));
  }

  lines.push(chalk.bold("── Summary ──────────────────────────────"));
  if (result.criticalCount > 0)
    lines.push(SEVERITY_COLOR.CRITICAL(`  CRITICAL : ${result.criticalCount}`));
  if (result.highCount > 0)
    lines.push(SEVERITY_COLOR.HIGH(`  HIGH     : ${result.highCount}`));
  if (result.mediumCount > 0)
    lines.push(SEVERITY_COLOR.MEDIUM(`  MEDIUM   : ${result.mediumCount}`));
  lines.push(`  Total    : ${result.totalIssues} issue(s) across ${filesScanned} file(s)`);
  lines.push("");

  // Risk Report — only when there are issues
  if (hasIssues) {
    const r = result.risk;
    lines.push(chalk.bold("── Risk Report ──────────────────────────"));
    lines.push(`  Score     : ${r.score}/100  ${riskLevelColor(r.level)}`);
    lines.push(`  Lock      : ${LOCK_LABEL[r.maxLock] ?? r.maxLock}`);
    lines.push(`  Rollback  : ${ROLLBACK_LABEL[r.maxRollback] ?? r.maxRollback}`);
    lines.push(`  Data loss : ${DATALOSS_LABEL[r.maxDataLoss] ?? r.maxDataLoss}`);
    if (r.hasIrreversible || r.hasCertainDataLoss) {
      lines.push("");
      lines.push(chalk.red.bold("  ⚠  Take a full backup before running this migration."));
    }
    lines.push("");
  }

  if (result.safe) {
    lines.push(chalk.green.bold("✔ SAFE — ready to deploy to production"));
  } else {
    lines.push(chalk.red.bold("✖ UNSAFE — resolve all CRITICAL/HIGH issues before deploying"));
  }

  lines.push("");
  return lines.join("\n");
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(
    {
      safe: result.safe,
      summary: {
        critical: result.criticalCount,
        high: result.highCount,
        medium: result.mediumCount,
        total: result.totalIssues,
      },
      risk: result.risk,
      files: result.results.map((r) => ({
        file: r.file,
        issueCount: r.issues.length,
        issues: r.issues.map((i) => ({
          severity: i.severity,
          line: i.line,
          statement: i.statement,
          message: i.message,
          suggestion: i.suggestion,
        })),
      })),
    },
    null,
    2
  );
}
