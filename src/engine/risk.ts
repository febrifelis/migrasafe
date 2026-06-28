import { Issue, LockType, RollbackDifficulty, DataLossRisk, RiskReport } from "../types";
import { ParsedStatement } from "../ast/types";
import { analyzeLock } from "../analysis/lock";
import { analyzeRollback } from "../analysis/rollback";
import { analyzeCost } from "../analysis/cost";
import { analyzeRewrite, downtimeLabel } from "../analysis/rewrite";
import { Rule, RULES } from "../checker/rules";

export interface RiskSubScores {
  lockScore:     number;   // 0–100: severity of lock acquired
  rewriteScore:  number;   // 0–100: table rewrite cost
  rollbackScore: number;   // 0–100: difficulty of reversal
  downtimeScore: number;   // 0–100: expected downtime impact
  dataLossScore: number;   // 0–100: probability and severity of data loss
}

export interface EnhancedRiskReport extends RiskReport {
  subScores: RiskSubScores;
}

const LOCK_ORDER:     LockType[]             = ["none", "row-exclusive", "share", "access-exclusive"];
const ROLLBACK_ORDER: RollbackDifficulty[]   = ["easy", "hard", "irreversible"];
const DATALOSS_ORDER: DataLossRisk[]         = ["none", "possible", "certain"];
const DOWNTIME_ORDER = ["none (online)", "< 1 second", "seconds to minutes (table-size dependent)", "minutes to hours (full table rewrite)", "requires maintenance window"];

function maxOf<T>(order: T[], values: T[]): T {
  return values.reduce((best, v) => order.indexOf(v) > order.indexOf(best) ? v : best, order[0]);
}

export function computeEnhancedRisk(
  issues:          Issue[],
  parsedStatements: ParsedStatement[] = [],
  extraRules:      Rule[]  = [],
): EnhancedRiskReport {
  if (issues.length === 0) {
    return {
      score: 0, level: "LOW",
      maxLock: "none", maxRollback: "easy", maxDataLoss: "none",
      hasIrreversible: false, hasCertainDataLoss: false,
      rewriteTables: [], estimatedDowntime: "none (online)",
      subScores: { lockScore: 0, rewriteScore: 0, rollbackScore: 0, downtimeScore: 0, dataLossScore: 0 },
    };
  }

  // Run sub-analyzers over all parsed statements
  const lockScores:     number[] = [];
  const rollbackScores: number[] = [];
  const costScores:     number[] = [];
  const rewriteTables:  string[] = [];

  for (const stmt of parsedStatements) {
    const lock     = analyzeLock(stmt);
    const rollback = analyzeRollback(stmt);
    const cost     = analyzeCost(stmt);
    const rewrite  = analyzeRewrite(stmt);

    lockScores.push(lock.score);
    rollbackScores.push(rollback.score);
    costScores.push(cost.score);

    if (rewrite.isTableRewrite && stmt.table && !rewriteTables.includes(stmt.table)) {
      rewriteTables.push(stmt.table);
    }
  }

  // Merge built-in rules with any plugin/extra rules; extra rules override built-ins on collision
  const ruleMap = new Map([...RULES, ...extraRules].map((r) => [r.id, r]));
  const locks:      LockType[]           = [];
  const rollbacks:  RollbackDifficulty[] = [];
  const dataLosses: DataLossRisk[]       = [];
  const downtimes:  string[]             = [];

  let score = 0;
  for (const issue of issues) {
    if (issue.severity === "CRITICAL") score += 30;
    else if (issue.severity === "HIGH") score += 15;
    else if (issue.severity === "MEDIUM") score += 5;

    const rule = ruleMap.get(issue.ruleId);
    if (rule) {
      locks.push(rule.lock);
      rollbacks.push(rule.rollback);
      dataLosses.push(rule.dataLoss);
    }

    downtimes.push(issue.estimatedDowntime ?? "< 1 second");
  }

  score = Math.min(100, score);

  const maxLock     = maxOf(LOCK_ORDER,     locks.length     ? locks     : (["none"] as LockType[]));
  const maxRollback = maxOf(ROLLBACK_ORDER, rollbacks.length ? rollbacks : (["easy"] as RollbackDifficulty[]));
  const maxDataLoss = maxOf(DATALOSS_ORDER, dataLosses.length ? dataLosses : (["none"] as DataLossRisk[]));

  const hasIrreversible    = maxRollback === "irreversible";
  const hasCertainDataLoss = maxDataLoss === "certain";

  if (hasCertainDataLoss) score = Math.max(score, 60);
  if (hasIrreversible)    score = Math.max(score, 50);

  const level: RiskReport["level"] =
    score >= 60 ? "CRITICAL" : score >= 40 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";

  const estimatedDowntime = downtimes.reduce(
    (best, d) => DOWNTIME_ORDER.indexOf(d) > DOWNTIME_ORDER.indexOf(best) ? d : best,
    "none (online)"
  );

  // Sub-scores derived from per-statement analysis
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0;

  const subScores: RiskSubScores = {
    lockScore:     max(lockScores),
    rewriteScore:  rewriteTables.length > 0 ? 90 : max(costScores),
    rollbackScore: max(rollbackScores),
    downtimeScore: Math.round(DOWNTIME_ORDER.indexOf(estimatedDowntime) / (DOWNTIME_ORDER.length - 1) * 100),
    dataLossScore: hasCertainDataLoss ? 100 : maxDataLoss === "possible" ? 50 : 0,
  };
  void avg; // unused but available for future use

  return {
    score, level, maxLock, maxRollback, maxDataLoss,
    hasIrreversible, hasCertainDataLoss,
    rewriteTables, estimatedDowntime,
    subScores,
  };
}
