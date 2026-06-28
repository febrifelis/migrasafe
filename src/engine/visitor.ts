import { StatementKind } from "../ast/types";
import { Severity } from "../types";
import { RuleContext } from "./context";

export interface VisitorIssue {
  ruleId: string;
  severity: Severity;
  message: string;
  suggestion?: string;
  confidence: number;
}

export interface Visitor {
  id: string;
  description: string;
  kinds: StatementKind[];
  visit(ctx: RuleContext): VisitorIssue[];
}

const registry: Visitor[] = [];

export function registerVisitor(v: Visitor): void {
  registry.push(v);
}

export function getVisitorsForKind(kind: StatementKind): Visitor[] {
  return registry.filter((v) => v.kinds.includes(kind));
}

export function getRegisteredKinds(): Set<StatementKind> {
  const kinds = new Set<StatementKind>();
  for (const v of registry) v.kinds.forEach((k) => kinds.add(k));
  return kinds;
}

export function getAllVisitors(): Visitor[] {
  return [...registry];
}
