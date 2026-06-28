import fs from "fs";
import path from "path";
import { Rule, PLUGIN_API_VERSION } from "../checker/rules";
import { MigrasafeConfig } from "../config";

export { PLUGIN_API_VERSION };

// Plugins may declare their target API version; we warn but still load if compatible
const SUPPORTED_API_VERSIONS = new Set(["1"]);

const REQUIRED_FIELDS: (keyof Rule)[] = [
  "id", "severity", "pattern", "message", "category", "dialect", "lock", "rollback", "dataLoss",
];

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

      // V3: Check plugin API version declaration
      const declaredVersion: string | undefined = exported?.PLUGIN_API_VERSION ?? mod?.PLUGIN_API_VERSION;
      if (declaredVersion !== undefined && !SUPPORTED_API_VERSIONS.has(String(declaredVersion))) {
        console.warn(
          `[migrasafe plugin] ${path.basename(resolved)} declares API version "${declaredVersion}" ` +
          `but MigraSafe supports ${[...SUPPORTED_API_VERSIONS].join(", ")}. Loading anyway.`
        );
      }

      const candidates: unknown[] = Array.isArray(exported)
        ? exported
        : Array.isArray(exported?.rules)
          ? exported.rules  // support { PLUGIN_API_VERSION, rules: [...] } export shape
          : [exported];

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
