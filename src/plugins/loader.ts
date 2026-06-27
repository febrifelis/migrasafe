import fs from "fs";
import path from "path";
import { Rule } from "../checker/rules";
import { MigrasafeConfig } from "../config";

const REQUIRED_FIELDS: (keyof Rule)[] = ["id", "severity", "pattern", "message", "category", "dialect", "lock", "rollback", "dataLoss"];

function validateRule(r: unknown, source: string): r is Rule {
  if (typeof r !== "object" || r === null) return false;
  const obj = r as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (obj[field] === undefined) {
      console.error(`[migrasafe plugin] Rule in ${source} missing field: ${field}`);
      return false;
    }
  }
  if (!(obj.pattern instanceof RegExp)) {
    console.error(`[migrasafe plugin] Rule "${obj.id}" in ${source}: pattern must be a RegExp`);
    return false;
  }
  return true;
}

export function loadPluginRules(config: MigrasafeConfig, cwd: string = process.cwd()): Rule[] {
  if (!config.plugins || config.plugins.length === 0) return [];

  const rules: Rule[] = [];
  for (const pluginPath of config.plugins) {
    const resolved = path.isAbsolute(pluginPath) ? pluginPath : path.join(cwd, pluginPath);
    if (!fs.existsSync(resolved)) {
      console.error(`[migrasafe plugin] Plugin not found: ${resolved}`);
      continue;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(resolved);
      const exported = mod?.default ?? mod;
      const candidates: unknown[] = Array.isArray(exported) ? exported : [exported];
      for (const candidate of candidates) {
        if (validateRule(candidate, resolved)) rules.push(candidate);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[migrasafe plugin] Failed to load ${resolved}: ${msg}`);
    }
  }
  return rules;
}
