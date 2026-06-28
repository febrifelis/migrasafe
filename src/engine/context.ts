import { ParsedStatement } from "../ast/types";
import { MigrasafeConfig } from "../config";

export interface RuleContext {
  ast: ParsedStatement;
  allStatements: ParsedStatement[];
  file: string;
  dialect: string;
  config: MigrasafeConfig;
}
