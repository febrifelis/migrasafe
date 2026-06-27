#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { checkDirectory, checkFile, buildScanResult } from "./checker/checker";
import { formatText, formatJson } from "./output/formatter";

const program = new Command();

program
  .name("migrasafe")
  .description("Detect unsafe SQL migrations before deploying to production")
  .version("1.0.0");

program
  .command("check <target>")
  .description("Check a SQL file or directory of migrations")
  .option("--format <format>", "Output format: text or json", "text")
  .action((target: string, options: { format: string }) => {
    const resolved = path.resolve(target);

    if (!fs.existsSync(resolved)) {
      console.error(`Error: path tidak ditemukan — ${resolved}`);
      process.exit(1);
    }

    const stat = fs.statSync(resolved);
    const results = stat.isDirectory()
      ? checkDirectory(resolved)
      : [checkFile(resolved)];

    const scanResult = buildScanResult(results);

    if (options.format === "json") {
      console.log(formatJson(scanResult));
    } else {
      console.log(formatText(scanResult));
    }

    process.exit(scanResult.safe ? 0 : 1);
  });

program.parse();
