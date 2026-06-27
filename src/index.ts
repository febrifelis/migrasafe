#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { checkDirectory, checkFile, buildScanResult } from "./checker/checker";
import { formatText, formatJson } from "./output/formatter";
import { loadConfig } from "./config";
import { Severity } from "./types";
import { RULES } from "./checker/rules";
import { Dialect } from "./config";

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

const program = new Command();

program
  .name("migrasafe")
  .description("Detect unsafe SQL migrations before deploying to production")
  .version("1.4.0");

program
  .command("check <target>")
  .description("Check a SQL file or directory of migrations")
  .option("--format <format>", "Output format: text or json", "text")
  .option("--ignore <patterns...>", "Glob/regex patterns to ignore (e.g. --ignore seed_ test_)")
  .option(
    "--min-severity <level>",
    "Minimum severity to report: CRITICAL, HIGH, MEDIUM, LOW, INFO",
    "INFO"
  )
  .option("--dialect <dialect>", "SQL dialect: postgresql, mysql, auto (default: auto)", "auto")
  .action(
    (
      target: string,
      options: { format: string; ignore?: string[]; minSeverity: string; dialect: string }
    ) => {
      const resolved = path.resolve(target);

      if (!fs.existsSync(resolved)) {
        console.error(`Error: path not found — ${resolved}`);
        process.exit(1);
      }

      // Load config file, then merge CLI flags (CLI takes precedence)
      const config = loadConfig();
      if (options.ignore) config.ignore = [...(config.ignore ?? []), ...options.ignore];
      if (options.dialect) config.dialect = options.dialect as Dialect;

      const minSeverity = (options.minSeverity.toUpperCase() as Severity) ?? "INFO";
      const minIndex = SEVERITY_ORDER.indexOf(minSeverity);

      let results;
      try {
        const stat = fs.statSync(resolved);
        const ignorePatterns = (config.ignore ?? []).map((p) => new RegExp(p));
        const isIgnored = ignorePatterns.some((re) => re.test(resolved));
        if (isIgnored) {
          console.log(`Skipped (ignored): ${resolved}`);
          process.exit(0);
        }
        results = stat.isDirectory()
          ? checkDirectory(resolved, config)
          : [checkFile(resolved, config)];
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }

      // Filter issues by min severity (always apply — default INFO keeps everything)
      results = results.map((r) => ({
        ...r,
        issues: r.issues.filter(
          (i) => SEVERITY_ORDER.indexOf(i.severity) <= minIndex
        ),
      }));

      const scanResult = buildScanResult(results);

      if (options.format === "json") {
        console.log(formatJson(scanResult));
      } else {
        console.log(formatText(scanResult));
      }

      process.exit(scanResult.safe ? 0 : 1);
    }
  );

program
  .command("rules")
  .description("List all detection rules with their severity, category, and dialect")
  .option("--format <format>", "Output format: text or json", "text")
  .option("--severity <level>", "Filter by severity: CRITICAL, HIGH, MEDIUM")
  .option("--category <cat>", "Filter by category: data-loss, breaking-change, performance, safety")
  .option("--dialect <d>", "Filter by dialect: all, postgresql, mysql")
  .action((options: { format: string; severity?: string; category?: string; dialect?: string }) => {
    let rules = [...RULES];
    if (options.severity) rules = rules.filter((r) => r.severity === options.severity!.toUpperCase());
    if (options.category) rules = rules.filter((r) => r.category === options.category!.toLowerCase());
    if (options.dialect)  rules = rules.filter((r) => r.dialect  === options.dialect!.toLowerCase());

    if (options.format === "json") {
      console.log(JSON.stringify(rules.map(({ id, severity, category, dialect, message, suggestion }) =>
        ({ id, severity, category, dialect, message, suggestion })
      ), null, 2));
      return;
    }

    const chalk = require("chalk");
    const severityColor = (s: string) =>
      s === "CRITICAL" ? chalk.bgRed.white.bold(` ${s} `) :
      s === "HIGH"     ? chalk.red.bold(s) :
      s === "MEDIUM"   ? chalk.yellow(s) : chalk.gray(s);

    console.log(`\n${chalk.bold(`${rules.length} rule(s)`)}\n`);
    for (const rule of rules) {
      console.log(`  ${severityColor(rule.severity).padEnd(12)}  ${chalk.bold(rule.id)}`);
      console.log(`  ${"".padEnd(12)}  ${chalk.gray("category:")} ${rule.category}  ${chalk.gray("dialect:")} ${rule.dialect}`);
      console.log(`  ${"".padEnd(12)}  ${rule.message}`);
      console.log();
    }
  });

program
  .command("install-hook")
  .description("Install a pre-commit git hook that runs migrasafe on staged .sql files")
  .action(() => {
    const hookDir = path.join(process.cwd(), ".git", "hooks");
    const hookPath = path.join(hookDir, "pre-commit");

    if (!fs.existsSync(hookDir)) {
      console.error("Error: .git/hooks directory not found. Are you in a git repository?");
      process.exit(1);
    }

    const hookScript = `#!/bin/sh
# migrasafe pre-commit hook
STAGED_SQL=$(git diff --cached --name-only --diff-filter=ACM | grep '\\.sql$')
if [ -z "$STAGED_SQL" ]; then
  exit 0
fi
echo "migrasafe: checking staged SQL migrations..."
echo "$STAGED_SQL" | xargs npx migrasafe check
`;

    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, "utf-8");
      if (existing.includes("migrasafe")) {
        console.log("migrasafe hook already installed.");
        process.exit(0);
      }
      // Append to existing hook
      fs.appendFileSync(hookPath, "\n" + hookScript);
      console.log("✔ migrasafe hook appended to existing pre-commit hook.");
    } else {
      fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
      console.log("✔ migrasafe pre-commit hook installed at .git/hooks/pre-commit");
    }
  });

program.parse();
