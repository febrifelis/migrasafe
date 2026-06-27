import fs from "fs";
import path from "path";
import { ScanResult } from "../types";

export interface Policy {
  maxRiskScore?: number;
  blockSeverities?: string[];
  requireApprovalAboveScore?: number;
  blockedRules?: string[];
  allowedDialects?: string[];
}

export interface PolicyViolation {
  rule: string;
  message: string;
  fatal: boolean;
}

export interface PolicyResult {
  passed: boolean;
  requiresApproval: boolean;
  violations: PolicyViolation[];
}

const POLICY_FILES = [".migrasafe-policy.json", "migrasafe.policy.json"];

export function loadPolicy(cwd: string = process.cwd()): Policy | null {
  for (const name of POLICY_FILES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf-8")) as Policy;
      } catch {
        console.error(`Warning: failed to parse policy file ${p}`);
      }
    }
  }
  return null;
}

export function evaluatePolicy(result: ScanResult, policy: Policy): PolicyResult {
  const violations: PolicyViolation[] = [];

  if (policy.maxRiskScore !== undefined && result.risk.score > policy.maxRiskScore) {
    violations.push({
      rule: "max-risk-score",
      message: `Risk score ${result.risk.score} exceeds policy maximum of ${policy.maxRiskScore}`,
      fatal: true,
    });
  }

  if (policy.blockSeverities && policy.blockSeverities.length > 0) {
    for (const sev of policy.blockSeverities) {
      const count = result.results.flatMap((r) => r.issues).filter((i) => i.severity === sev.toUpperCase()).length;
      if (count > 0) {
        violations.push({
          rule: `block-severity-${sev}`,
          message: `Policy blocks ${sev} severity issues (${count} found)`,
          fatal: true,
        });
      }
    }
  }

  if (policy.blockedRules && policy.blockedRules.length > 0) {
    const allIssues = result.results.flatMap((r) => r.issues);
    for (const blockedRuleId of policy.blockedRules) {
      // Match by checking if any issue message contains the rule ID pattern
      // (since issues carry message, not rule ID — best effort match)
      const found = allIssues.some((i) => i.message.includes(blockedRuleId));
      if (found) {
        violations.push({
          rule: `blocked-rule-${blockedRuleId}`,
          message: `Policy explicitly blocks rule: ${blockedRuleId}`,
          fatal: true,
        });
      }
    }
  }

  const requiresApproval =
    policy.requireApprovalAboveScore !== undefined &&
    result.risk.score > policy.requireApprovalAboveScore;

  const passed = violations.filter((v) => v.fatal).length === 0;
  return { passed, requiresApproval, violations };
}

export function formatPolicyResult(pr: PolicyResult): string {
  const lines: string[] = [];
  if (pr.violations.length === 0 && !pr.requiresApproval) {
    lines.push("✔ Policy check passed — no violations.");
    return lines.join("\n");
  }
  if (pr.violations.length > 0) {
    lines.push("✖ Policy violations:");
    for (const v of pr.violations) {
      lines.push(`  [${v.fatal ? "BLOCK" : "WARN"}] ${v.message}`);
    }
  }
  if (pr.requiresApproval) {
    lines.push("⚠ This migration requires approval before deploying.");
    lines.push("  Run: migrasafe approve generate <ticket-id>");
  }
  return lines.join("\n");
}
