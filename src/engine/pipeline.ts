/**
 * Rule Pipeline: Parser → Semantic Analyzer → Visitors → Fallback Regex → Risk Engine
 *
 * For statement kinds with registered Visitors, Visitors run exclusively.
 * For unknown kinds or kinds without Visitors, regex Rules run as fallback.
 * All issues are enriched with Lock, Rollback, Cost, and Rewrite metadata.
 */

// Side-effect: register all visitors
import "./visitors/drop";
import "./visitors/alter";
import "./visitors/dml";
import "./visitors/create";
import "./visitors/maintenance";

import { ParsedStatement } from "../ast/types";
import { Issue, Severity } from "../types";
import { MigrasafeConfig } from "../config";
import { Rule, checkStatement } from "../checker/rules";
import { RuleContext } from "./context";
import { getVisitorsForKind, getRegisteredKinds } from "./visitor";
import { analyzeLock } from "../analysis/lock";
import { analyzeRollback } from "../analysis/rollback";
import { analyzeCost } from "../analysis/cost";
import { analyzeRewrite, downtimeLabel } from "../analysis/rewrite";
import { analyzeAffectedObjects } from "../analysis/objects";

export interface PipelineIssue extends Issue {
  // All Issue fields are present; this alias clarifies pipeline output
}

export interface PipelineOptions {
  dialect:         string;
  disableRules:    string[];
  severityOverrides: Record<string, Severity>;
  pluginRules:     Rule[];
  config:          MigrasafeConfig;
  allStatements:   ParsedStatement[];
  file:            string;
}

const REGISTERED_KINDS = getRegisteredKinds();

export function runPipeline(
  stmt:   ParsedStatement,
  raw:    string,
  line:   number,
  opts:   PipelineOptions,
): PipelineIssue[] {
  const ctx: RuleContext = {
    ast:           stmt,
    allStatements: opts.allStatements,
    file:          opts.file,
    dialect:       opts.dialect,
    config:        opts.config,
  };

  let visitorIssues: Omit<Issue, "file" | "line" | "statement">[] = [];

  if (REGISTERED_KINDS.has(stmt.kind)) {
    // AST path: run all registered visitors for this kind
    const visitors = getVisitorsForKind(stmt.kind);
    for (const visitor of visitors) {
      const results = visitor.visit(ctx);
      for (const r of results) {
        if (opts.disableRules.includes(r.ruleId)) continue;
        visitorIssues.push({
          ruleId:    r.ruleId,
          severity:  opts.severityOverrides[r.ruleId] ?? r.severity,
          message:   r.message,
          suggestion: r.suggestion,
          confidence: r.confidence,
          affectedObjects: [],
          isTableRewrite: false,
          estimatedDowntime: undefined,
        });
      }
    }

    // Plugin rules always run regardless of visitor coverage (they're user-defined)
    if (opts.pluginRules.length > 0) {
      const fileName = opts.file.split(/[\\/]/).pop() ?? opts.file;
      const pluginOnly = checkStatement(
        raw, line, fileName,
        opts.disableRules,
        opts.severityOverrides,
        opts.dialect as import("../config").Dialect,
        opts.pluginRules,
      ).filter((i) => opts.pluginRules.some((r) => r.id === i.ruleId));
      for (const i of pluginOnly) {
        visitorIssues.push({
          ruleId:     i.ruleId,
          severity:   i.severity,
          message:    i.message,
          suggestion: i.suggestion,
          confidence: i.confidence,
          affectedObjects: [],
          isTableRewrite: false,
          estimatedDowntime: undefined,
        });
      }
    }
  } else {
    // Fallback regex path for unknown/uncovered statement kinds
    const fileName = opts.file.split(/[\\/]/).pop() ?? opts.file;
    const raw_issues = checkStatement(
      raw, line, fileName,
      opts.disableRules,
      opts.severityOverrides,
      opts.dialect as import("../config").Dialect,
      opts.pluginRules,
    );
    visitorIssues = raw_issues.map((i) => ({
      ruleId:     i.ruleId,
      severity:   i.severity,
      message:    i.message,
      suggestion: i.suggestion,
      confidence: i.confidence,
      affectedObjects: [],
      isTableRewrite: false,
      estimatedDowntime: undefined,
    }));
  }

  // Enrich every issue with per-statement analysis
  const lock     = analyzeLock(stmt);
  const rollback = analyzeRollback(stmt);
  const cost     = analyzeCost(stmt);
  const rewrite  = analyzeRewrite(stmt);
  const objects  = analyzeAffectedObjects(stmt);

  const stmtText = raw.split("\n")[0].substring(0, 120);

  return visitorIssues.map((vi): PipelineIssue => ({
    ...vi,
    file:             opts.file,
    line,
    statement:        stmtText,
    affectedObjects:  objects.categories,
    isTableRewrite:   rewrite.isTableRewrite || cost.isTableRewrite,
    estimatedDowntime: downtimeLabel(rewrite.downtimeEstimate),
    // Blend visitor confidence with lock/rollback certainty
    confidence: Math.round(
      Math.min(1.0, vi.confidence * 0.7 + (1 - lock.score / 100) * 0.1 + (1 - rollback.score / 100) * 0.2) * 100
    ) / 100,
  }));
}
