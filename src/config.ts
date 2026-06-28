import fs from "fs";
import path from "path";
import { Severity } from "./types";

export type Dialect = "postgresql" | "mysql" | "auto";

export interface MigrasafeConfig {
  ignore?: string[];
  disableRules?: string[];
  minSeverity?: Severity;
  dialect?: Dialect;
  rules?: Record<string, { severity?: Severity; disabled?: boolean }>;
  plugins?: string[];
}

const CONFIG_FILES = [".migrasaferc.json", ".migrasaferc", "migrasafe.config.json"];

export function loadConfig(cwd: string = process.cwd()): MigrasafeConfig {
  let dir = path.resolve(cwd);
  const root = path.parse(dir).root;

  while (true) {
    for (const name of CONFIG_FILES) {
      const filePath = path.join(dir, name);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
          return JSON.parse(raw) as MigrasafeConfig;
        } catch {
          console.error(`Warning: failed to parse config file ${filePath}`);
        }
      }
    }
    // Stop at filesystem root or when a .git directory is found (project boundary)
    const parent = path.dirname(dir);
    if (dir === root || dir === parent || fs.existsSync(path.join(dir, ".git"))) break;
    dir = parent;
  }
  return {};
}
