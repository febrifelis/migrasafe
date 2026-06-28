import chalk from "chalk";
import path from "path";
import { ScanResult, Severity, RiskReport } from "../types";
import { RULES } from "../checker/rules";

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
      const conf = issue.confidence !== undefined ? chalk.dim(` [${Math.round(issue.confidence * 100)}% confidence]`) : "";
      lines.push(`  ${color(icon)}  Line ${issue.line}${conf}`);
      lines.push(`  ${chalk.dim("Statement:")} ${chalk.white(issue.statement)}`);
      lines.push(`  ${chalk.dim("Problem  :")} ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`  ${chalk.dim("Fix      :")} ${chalk.cyan(issue.suggestion)}`);
      }
      if (issue.estimatedDowntime && issue.estimatedDowntime !== "< 1 second" && issue.estimatedDowntime !== "none (online)") {
        lines.push(`  ${chalk.dim("Downtime :")} ${chalk.yellow(issue.estimatedDowntime)}`);
      }
      if (issue.isTableRewrite) {
        lines.push(`  ${chalk.dim("Impact   :")} ${chalk.red.bold("⚠ FULL TABLE REWRITE — proportional to table size")}`);
      }
      if (issue.affectedObjects && issue.affectedObjects.length > 0) {
        lines.push(`  ${chalk.dim("Affects  :")} ${issue.affectedObjects.join(", ")}`);
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
    lines.push(`  Score     : ${r.score}/100   ${riskLevelColor(r.level)}`);
    lines.push(`  Lock      : ${LOCK_LABEL[r.maxLock] ?? r.maxLock}`);
    lines.push(`  Rollback  : ${ROLLBACK_LABEL[r.maxRollback] ?? r.maxRollback}`);
    lines.push(`  Data loss : ${DATALOSS_LABEL[r.maxDataLoss] ?? r.maxDataLoss}`);
    if (r.estimatedDowntime && r.estimatedDowntime !== "none (online)" && r.estimatedDowntime !== "< 1 second") {
      lines.push(`  Downtime  : ${chalk.yellow(r.estimatedDowntime)}`);
    }
    if (r.rewriteTables && r.rewriteTables.length > 0) {
      lines.push(`  Rewrites  : ${chalk.red(r.rewriteTables.join(", "))} (full table rewrite)`);
    }
    if (r.subScores) {
      const s = r.subScores;
      lines.push(chalk.dim(`  Sub-scores: lock=${s.lockScore} rewrite=${s.rewriteScore} rollback=${s.rollbackScore} downtime=${s.downtimeScore} dataLoss=${s.dataLossScore}`));
    }
    if (r.hasIrreversible || r.hasCertainDataLoss) {
      lines.push("");
      lines.push(chalk.red.bold("  ⚠  Take a full backup before running this migration."));
    }
    lines.push("");
  }

  // V3: Dependency warnings
  if (result.dependencyWarnings && result.dependencyWarnings.length > 0) {
    lines.push(chalk.bold("── Dependency Analysis ──────────────────"));
    for (const w of result.dependencyWarnings) {
      const icon = w.type === "safe-workflow" ? chalk.green("✔") : w.type === "missing-step" ? chalk.yellow("⚠") : chalk.blue("ℹ");
      lines.push(`  ${icon} ${w.message}`);
      if (w.suggestion && w.type !== "safe-workflow") {
        lines.push(`    ${chalk.dim("→")} ${chalk.cyan(w.suggestion)}`);
      }
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

// ── Markdown ──────────────────────────────────────────────────────────────

export function formatMarkdown(result: ScanResult): string {
  const lines: string[] = [];
  const { safe, criticalCount, highCount, mediumCount, totalIssues, risk, results } = result;

  const statusIcon = safe ? "✅" : "❌";
  const statusText = safe ? "SAFE — ready to deploy" : "UNSAFE — resolve CRITICAL/HIGH issues before deploying";

  lines.push(`## ${statusIcon} migrasafe — ${statusText}`);
  lines.push("");

  if (totalIssues > 0) {
    lines.push("### Summary");
    lines.push("");
    lines.push("| Severity | Count |");
    lines.push("|---|---|");
    if (criticalCount > 0) lines.push(`| 🔴 CRITICAL | ${criticalCount} |`);
    if (highCount > 0)     lines.push(`| 🟠 HIGH     | ${highCount} |`);
    if (mediumCount > 0)   lines.push(`| 🟡 MEDIUM   | ${mediumCount} |`);
    lines.push(`| **Total** | **${totalIssues}** |`);
    lines.push("");

    lines.push("### Risk Report");
    lines.push("");
    const riskEmoji = risk.level === "CRITICAL" ? "🔴" : risk.level === "HIGH" ? "🟠" : risk.level === "MEDIUM" ? "🟡" : "🟢";
    lines.push(`| | |`);
    lines.push(`|---|---|`);
    lines.push(`| Score | **${risk.score}/100** ${riskEmoji} ${risk.level} |`);
    lines.push(`| Lock impact | ${risk.maxLock} |`);
    lines.push(`| Rollback | ${risk.maxRollback} |`);
    lines.push(`| Data loss | ${risk.maxDataLoss} |`);
    lines.push("");

    if (risk.hasIrreversible || risk.hasCertainDataLoss) {
      lines.push("> ⚠️ **Take a full backup before running this migration.**");
      lines.push("");
    }

    lines.push("### Issues");
    lines.push("");

    for (const fileResult of results) {
      if (fileResult.issues.length === 0) continue;
      const relFile = path.relative(process.cwd(), fileResult.file).replace(/\\/g, "/");
      lines.push(`#### \`${relFile}\``);
      lines.push("");
      lines.push("| Severity | Line | Statement | Problem |");
      lines.push("|---|---|---|---|");
      for (const issue of fileResult.issues) {
        const icon = issue.severity === "CRITICAL" ? "🔴" : issue.severity === "HIGH" ? "🟠" : "🟡";
        const stmt = issue.statement.replace(/\|/g, "\\|");
        const msg  = issue.message.replace(/\|/g, "\\|");
        lines.push(`| ${icon} ${issue.severity} | ${issue.line} | \`${stmt}\` | ${msg} |`);
      }
      lines.push("");
    }
  } else {
    lines.push("No issues found. ✔");
    lines.push("");
  }

  lines.push(`<sub>Generated by [migrasafe](https://github.com/febrifelis/migrasafe)</sub>`);
  return lines.join("\n");
}

// ── HTML ──────────────────────────────────────────────────────────────────

const HTML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escHtml(s: string): string { return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c); }

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#e03131", HIGH: "#e67700", MEDIUM: "#d9770a",
};
const SEV_BG: Record<string, string> = {
  CRITICAL: "#fff0f0", HIGH: "#fff4e6", MEDIUM: "#fffbe6",
};

export function formatHtml(result: ScanResult): string {
  const { safe, criticalCount, highCount, mediumCount, totalIssues, risk, results } = result;

  const issueRows = results.flatMap((r) =>
    r.issues.map((i) => {
      const color = SEV_COLOR[i.severity] ?? "#555";
      const bg    = SEV_BG[i.severity]    ?? "#fafafa";
      return `
      <tr style="background:${bg}">
        <td style="color:${color};font-weight:bold;white-space:nowrap">${i.severity}</td>
        <td>${escHtml(path.basename(r.file))}:${i.line}</td>
        <td><code>${escHtml(i.statement)}</code></td>
        <td>${escHtml(i.message)}</td>
        <td style="color:#1864ab">${escHtml(i.suggestion ?? "")}</td>
      </tr>`;
    })
  ).join("");

  const safeColor = safe ? "#2f9e44" : "#c92a2a";
  const safeText  = safe ? "✔ SAFE" : "✖ UNSAFE";

  const riskColor = risk.level === "CRITICAL" ? "#c92a2a"
    : risk.level === "HIGH" ? "#e67700"
    : risk.level === "MEDIUM" ? "#d9770a" : "#2f9e44";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>migrasafe report</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f8f9fa;color:#212529}
  h1{font-size:1.4rem;margin:0 0 4px}
  .badge{display:inline-block;padding:4px 12px;border-radius:4px;font-weight:700;font-size:1rem;color:#fff;background:${safeColor}}
  .card{background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin:16px 0}
  .stat{display:inline-block;margin-right:24px;font-size:1.1rem}
  .stat span{font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:0.85rem}
  th{background:#e9ecef;padding:8px 10px;text-align:left;font-size:0.8rem;text-transform:uppercase;letter-spacing:.04em}
  td{padding:8px 10px;border-bottom:1px solid #f1f3f5;vertical-align:top}
  code{background:#f1f3f5;padding:2px 6px;border-radius:3px;font-size:0.8rem;word-break:break-all}
  .risk-score{font-size:2rem;font-weight:700;color:${riskColor}}
  .footer{margin-top:24px;font-size:0.75rem;color:#868e96}
</style>
</head>
<body>
<h1>migrasafe report <span class="badge">${safeText}</span></h1>
<div class="card">
  <div class="stat">Files scanned: <span>${results.length}</span></div>
  <div class="stat">Issues: <span>${totalIssues}</span></div>
  ${criticalCount ? `<div class="stat" style="color:#c92a2a">Critical: <span>${criticalCount}</span></div>` : ""}
  ${highCount     ? `<div class="stat" style="color:#e67700">High: <span>${highCount}</span></div>` : ""}
  ${mediumCount   ? `<div class="stat" style="color:#d9770a">Medium: <span>${mediumCount}</span></div>` : ""}
</div>
${totalIssues > 0 ? `
<div class="card">
  <h2 style="margin:0 0 12px;font-size:1rem">Risk Report</h2>
  <div class="risk-score">${risk.score}<small style="font-size:1rem;font-weight:400;color:#495057">/100 — ${risk.level}</small></div>
  <p style="margin:8px 0 0"><b>Lock:</b> ${risk.maxLock} &nbsp;|&nbsp; <b>Rollback:</b> ${risk.maxRollback} &nbsp;|&nbsp; <b>Data loss:</b> ${risk.maxDataLoss}</p>
  ${risk.hasIrreversible || risk.hasCertainDataLoss ? `<p style="color:#c92a2a;font-weight:700;margin-top:12px">⚠ Take a full backup before running this migration.</p>` : ""}
</div>
<div class="card">
  <h2 style="margin:0 0 12px;font-size:1rem">Issues</h2>
  <table>
    <thead><tr><th>Severity</th><th>Location</th><th>Statement</th><th>Problem</th><th>Fix</th></tr></thead>
    <tbody>${issueRows}</tbody>
  </table>
</div>` : `<div class="card" style="color:#2f9e44;font-weight:600">✔ No issues found — all migrations are safe.</div>`}
<div class="footer">Generated by <a href="https://github.com/febrifelis/migrasafe">migrasafe</a></div>
</body>
</html>`;
}

// ── SARIF 2.1.0 ──────────────────────────────────────────────────────────

export function formatSarif(result: ScanResult, version = "1.4.0"): string {
  const ruleMap = new Map((RULES as { id: string; message: string; severity: string; suggestion?: string }[])
    .map((r) => [r.id, r]));

  // Build SARIF rules list from unique rule IDs in issues
  const usedRuleIds = new Set(
    result.results.flatMap((r) => r.issues.map((i) => i.ruleId))
  );

  const sarifRules = [...ruleMap.values()]
    .filter((r: { id: string }) => usedRuleIds.has(r.id))
    .map((r: { id: string; severity: string; message: string; suggestion?: string }) => ({
      id: r.id,
      name: r.id,
      shortDescription: { text: r.message },
      fullDescription: { text: r.suggestion ?? r.message },
      defaultConfiguration: {
        level: r.severity === "CRITICAL" || r.severity === "HIGH" ? "error" : "warning",
      },
      helpUri: `https://github.com/febrifelis/migrasafe#rules`,
    }));

  const sarifResults = result.results.flatMap((fileResult) =>
    fileResult.issues.map((issue) => {
      const ruleId = issue.ruleId;
      const level = issue.severity === "CRITICAL" || issue.severity === "HIGH" ? "error" : "warning";
      return {
        ruleId,
        level,
        message: { text: issue.message },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: fileResult.file.replace(/\\/g, "/"), uriBaseId: "%SRCROOT%" },
            region: { startLine: issue.line },
          },
        }],
      };
    })
  );

  return JSON.stringify({
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "migrasafe",
          version,
          informationUri: "https://github.com/febrifelis/migrasafe",
          rules: sarifRules,
        },
      },
      results: sarifResults,
    }],
  }, null, 2);
}

// ── JSON ──────────────────────────────────────────────────────────────────

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
      dependencyWarnings: result.dependencyWarnings ?? [],
      workflows: result.workflows ?? [],
      files: result.results.map((r) => ({
        file: r.file,
        issueCount: r.issues.length,
        issues: r.issues.map((i) => ({
          ruleId: i.ruleId,
          severity: i.severity,
          confidence: i.confidence,
          line: i.line,
          statement: i.statement,
          message: i.message,
          suggestion: i.suggestion,
          estimatedDowntime: i.estimatedDowntime,
          isTableRewrite: i.isTableRewrite,
          affectedObjects: i.affectedObjects,
        })),
      })),
    },
    null,
    2
  );
}
