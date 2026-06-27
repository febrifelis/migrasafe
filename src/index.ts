#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { checkDirectory, checkFile, buildScanResult } from "./checker/checker";
import { formatText, formatJson } from "./output/formatter";
import { loadConfig } from "./config";
import { Severity } from "./types";

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

const program = new Command();

program
  .name("migrasafe")
  .description("Detect unsafe SQL migrations before deploying to production")
  .version("1.0.0");

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
  .action(
    (
      target: string,
      options: { format: string; ignore?: string[]; minSeverity: string }
    ) => {
      const resolved = path.resolve(target);

      if (!fs.existsSync(resolved)) {
        console.error(`Error: path not found — ${resolved}`);
        process.exit(1);
      }

      // Load config file, then merge CLI flags (CLI takes precedence)
      const config = loadConfig();
      if (options.ignore) config.ignore = [...(config.ignore ?? []), ...options.ignore];

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
