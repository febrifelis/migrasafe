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
  for (const name of CONFIG_FILES) {
    const filePath = path.join(cwd, name);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
        return JSON.parse(raw) as MigrasafeConfig;
      } catch {
        console.error(`Warning: failed to parse config file ${filePath}`);
      }
    }
  }
  return {};
}
