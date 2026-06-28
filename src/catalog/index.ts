import { RULES, Rule } from "../checker/rules";

export interface CatalogEntry {
  id: string;
  severity: string;
  category: string;
  dialect: string;
  confidence: number;
  lock: string;
  rollback: string;
  dataLoss: string;
  message: string;
  suggestion?: string;
}

export function buildCatalog(extraRules: Rule[] = []): CatalogEntry[] {
  return [...RULES, ...extraRules].map((r) => ({
    id: r.id,
    severity: r.severity,
    category: r.category,
    dialect: r.dialect,
    confidence: r.confidence ?? 0.85,
    lock: r.lock,
    rollback: r.rollback,
    dataLoss: r.dataLoss,
    message: r.message,
    suggestion: r.suggestion,
  }));
}

export function formatCatalogMarkdown(entries: CatalogEntry[]): string {
  const bySeverity: Record<string, CatalogEntry[]> = {};
  for (const e of entries) {
    (bySeverity[e.severity] ??= []).push(e);
  }

  const lines: string[] = [
    "# MigraSafe Rule Catalog",
    "",
    `> Auto-generated from ${entries.length} rules across all dialects.`,
    "",
    "## Summary",
    "",
    "| Severity | Count |",
    "|---|---|",
  ];

  for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]) {
    const count = bySeverity[sev]?.length ?? 0;
    if (count > 0) lines.push(`| ${sev} | ${count} |`);
  }

  lines.push("", "---", "");

  for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]) {
    const group = bySeverity[sev];
    if (!group?.length) continue;

    const icon = sev === "CRITICAL" ? "🔴" : sev === "HIGH" ? "🟠" : sev === "MEDIUM" ? "🟡" : "🔵";
    lines.push(`## ${icon} ${sev} Rules`, "");

    for (const e of group) {
      lines.push(
        `### \`${e.id}\``,
        "",
        `**Dialect:** ${e.dialect}  **Category:** ${e.category}  **Confidence:** ${Math.round(e.confidence * 100)}%`,
        "",
        `**Lock:** \`${e.lock}\`  **Rollback:** \`${e.rollback}\`  **Data Loss:** \`${e.dataLoss}\``,
        "",
        `**Problem:** ${e.message}`,
        "",
      );
      if (e.suggestion) {
        lines.push(`**Fix:** ${e.suggestion}`, "");
      }
      lines.push("---", "");
    }
  }

  return lines.join("\n");
}

export function formatCatalogJson(entries: CatalogEntry[]): string {
  return JSON.stringify({ version: "3.0.0", ruleCount: entries.length, rules: entries }, null, 2);
}
