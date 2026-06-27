import chalk from "chalk";
import path from "path";
import { ScanResult, Severity } from "../types";

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
    lines.push(chalk.green("✔ Semua migration aman — tidak ada issue ditemukan.\n"));
  }

  lines.push(chalk.bold("── Summary ──────────────────────────────"));
  if (result.criticalCount > 0)
    lines.push(SEVERITY_COLOR.CRITICAL(`  CRITICAL : ${result.criticalCount}`));
  if (result.highCount > 0)
    lines.push(SEVERITY_COLOR.HIGH(`  HIGH     : ${result.highCount}`));
  if (result.mediumCount > 0)
    lines.push(SEVERITY_COLOR.MEDIUM(`  MEDIUM   : ${result.mediumCount}`));
  lines.push(`  Total    : ${result.totalIssues} issue(s) dalam ${filesScanned} file`);
  lines.push("");

  if (result.safe) {
    lines.push(chalk.green.bold("✔ SAFE — aman untuk deploy ke production"));
  } else {
    lines.push(chalk.red.bold("✖ UNSAFE — selesaikan issue CRITICAL/HIGH sebelum deploy"));
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
