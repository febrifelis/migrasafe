#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import os from "os";
import { checkDirectory, checkFile, buildScanResult } from "./checker/checker";
import { formatText, formatJson, formatMarkdown, formatHtml, formatSarif } from "./output/formatter";
import { loadConfig } from "./config";
import { Severity } from "./types";
import { RULES } from "./checker/rules";
import { Dialect } from "./config";
import { appendHistory, loadHistory } from "./dashboard/history";
import { generateDashboard } from "./dashboard/generator";
import { loadPolicy, evaluatePolicy, formatPolicyResult } from "./enterprise/policy";
import { generateApprovalRequest, approveRequest, rejectRequest, getApprovalStatus, listApprovals } from "./enterprise/approval";
import { sendSlackNotification, sendWebhookNotification } from "./enterprise/notifications";
import { getAllPatterns, getSuggestionForRule, formatPattern } from "./ai/suggestions";
import { loadPluginRules } from "./plugins/loader";
import { generateCoverageReport, formatCoverageText } from "./coverage";
import { buildCatalog, formatCatalogMarkdown, formatCatalogJson } from "./catalog";
import { runBenchmarkSuite, formatBenchmarkText } from "./benchmark";

const VERSION = "3.0.0";
const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

const program = new Command();

program
  .name("migrasafe")
  .description("Detect unsafe SQL migrations before deploying to production")
  .version(VERSION);

// ── check ──────────────────────────────────────────────────────────────────

program
  .command("check <target>")
  .description("Check a SQL file or directory of migrations")
  .option("--format <format>", "Output format: text, json, markdown, html, sarif", "text")
  .option("--ignore <patterns...>", "Glob/regex patterns to ignore")
  .option("--min-severity <level>", "Minimum severity to report: CRITICAL, HIGH, MEDIUM, LOW, INFO", "INFO")
  .option("--dialect <dialect>", "SQL dialect: postgresql, mysql, auto", "auto")
  .option("--save-history", "Append scan result to .migrasafe-history.ndjson")
  .option("--notify-slack <url>", "Send result to a Slack webhook URL")
  .option("--notify-webhook <url>", "Send result to a generic webhook URL")
  .option("--policy", "Evaluate .migrasafe-policy.json after scanning")
  .action(async (
    target: string,
    options: {
      format: string;
      ignore?: string[];
      minSeverity: string;
      dialect: string;
      saveHistory?: boolean;
      notifySlack?: string;
      notifyWebhook?: string;
      policy?: boolean;
    }
  ) => {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: path not found — ${resolved}`);
      process.exit(1);
    }

    const config = loadConfig();
    if (options.ignore) config.ignore = [...(config.ignore ?? []), ...options.ignore];
    if (options.dialect) config.dialect = options.dialect as Dialect;
    const pluginRules = loadPluginRules(config);

    const minSeverity = (options.minSeverity.toUpperCase() as Severity) ?? "INFO";
    const minIndex = SEVERITY_ORDER.indexOf(minSeverity);

    let results;
    try {
      const stat = fs.statSync(resolved);
      const ignorePatterns = (config.ignore ?? []).flatMap((p) => {
        try { return [new RegExp(p)]; } catch { process.stderr.write(`Warning: invalid ignore pattern skipped: ${p}\n`); return []; }
      });
      if (ignorePatterns.some((re) => re.test(resolved))) {
        console.log(`Skipped (ignored): ${resolved}`);
        process.exit(0);
      }
      results = stat.isDirectory()
        ? checkDirectory(resolved, config)
        : [checkFile(resolved, config)];
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }

    results = results.map((r) => ({
      ...r,
      issues: r.issues.filter((i) => SEVERITY_ORDER.indexOf(i.severity) <= minIndex),
    }));

    const scanResult = buildScanResult(results, pluginRules);

    // Output
    const fmt = options.format.toLowerCase();
    if (fmt === "json") {
      console.log(formatJson(scanResult));
    } else if (fmt === "markdown" || fmt === "md") {
      console.log(formatMarkdown(scanResult));
    } else if (fmt === "html") {
      console.log(formatHtml(scanResult));
    } else if (fmt === "sarif") {
      console.log(formatSarif(scanResult, VERSION));
    } else {
      console.log(formatText(scanResult));
    }

    // History
    if (options.saveHistory) {
      appendHistory(scanResult, target, VERSION);
    }

    // Notifications (fire and forget, don't block exit)
    const notifCfg = {
      slackWebhookUrl: options.notifySlack ?? (config as { notifications?: { slackWebhookUrl?: string } }).notifications?.slackWebhookUrl,
      webhookUrl: options.notifyWebhook ?? (config as { notifications?: { webhookUrl?: string } }).notifications?.webhookUrl,
      notifyOnUnsafe: true,
    };
    try {
      await Promise.all([
        sendSlackNotification(scanResult, target, notifCfg),
        sendWebhookNotification(scanResult, target, notifCfg),
      ]);
    } catch (err) {
      console.error(`Warning: notification failed — ${err instanceof Error ? err.message : err}`);
    }

    // Policy check
    if (options.policy) {
      const policy = loadPolicy();
      if (policy) {
        const pr = evaluatePolicy(scanResult, policy);
        console.log("\n" + formatPolicyResult(pr));
        if (!pr.passed || pr.requiresApproval) process.exit(2);
        if (pr.requiresApproval) {
          console.log("\nRun: migrasafe approve generate <ticket-id>");
        }
      } else {
        console.error("Warning: --policy flag used but no .migrasafe-policy.json found.");
      }
    }

    process.exit(scanResult.safe ? 0 : 1);
  });

// ── suggest ────────────────────────────────────────────────────────────────

program
  .command("suggest [target]")
  .description("Show safe migration patterns for issues found in a file or list all patterns")
  .option("--rule <id>", "Show suggestion for a specific rule ID")
  .option("--list", "List all available migration patterns")
  .action(async (target: string | undefined, options: { rule?: string; list?: boolean }) => {
    const chalk = require("chalk");

    if (options.list) {
      const patterns = getAllPatterns();
      console.log(chalk.bold(`\n${patterns.length} safe migration pattern(s):\n`));
      for (const p of patterns) {
        console.log(`  ${chalk.bold(p.ruleId.padEnd(35))} ${p.title}`);
      }
      console.log("\nRun: migrasafe suggest --rule <RULE_ID> for details\n");
      return;
    }

    if (options.rule) {
      const p = getSuggestionForRule(options.rule.toUpperCase());
      if (!p) {
        console.error(`No pattern found for rule: ${options.rule}`);
        process.exit(1);
      }
      console.log(chalk.bold(`\nSafe migration guide — ${p.title}`) + formatPattern(p) + "\n");
      return;
    }

    if (!target) {
      console.error("Usage: migrasafe suggest <file> | --rule <RULE_ID> | --list");
      process.exit(1);
    }

    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: path not found — ${resolved}`);
      process.exit(1);
    }

    const config = loadConfig();
    const pluginRules = loadPluginRules(config);
    const allRules = [...RULES, ...pluginRules];
    const results = fs.statSync(resolved).isDirectory()
      ? checkDirectory(resolved, config)
      : [checkFile(resolved, config)];
    const scanResult = buildScanResult(results, pluginRules);

    if (scanResult.totalIssues === 0) {
      console.log(chalk.green("\n✔ No issues — no suggestions needed.\n"));
      return;
    }

    const seenRules = new Set<string>();
    let patternsShown = 0;
    for (const fileResult of scanResult.results) {
      for (const issue of fileResult.issues) {
        const rule = allRules.find((r) => r.message === issue.message);
        if (!rule || seenRules.has(rule.id)) continue;
        seenRules.add(rule.id);
        const pattern = getSuggestionForRule(rule.id);
        if (pattern) {
          console.log(chalk.bold(`\nSafe migration guide for ${chalk.red(rule.id)}:`) + formatPattern(pattern));
          patternsShown++;
        }
      }
    }

    if (patternsShown === 0) {
      const ruleIds = [...seenRules].join(", ") || "unknown";
      console.log(`\nNo safe migration patterns available for the detected rules (${ruleIds}).`);
      console.log(`Run: migrasafe suggest --list  to see all available patterns.\n`);
    } else {
      console.log();
    }
  });

// ── rules ──────────────────────────────────────────────────────────────────

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

// ── dashboard ──────────────────────────────────────────────────────────────

program
  .command("dashboard")
  .description("Generate an HTML dashboard from scan history (.migrasafe-history.ndjson)")
  .option("--output <file>", "Output file (default: migrasafe-dashboard.html)", "migrasafe-dashboard.html")
  .option("--open", "Open the dashboard in the default browser after generating")
  .action((options: { output: string; open?: boolean }) => {
    const history = loadHistory();
    const html = generateDashboard(history);
    const outPath = path.resolve(options.output);
    fs.writeFileSync(outPath, html, "utf-8");
    console.log(`✔ Dashboard written to ${outPath}`);
    if (options.open) {
      const { execFile, spawn } = require("child_process") as typeof import("child_process");
      if (process.platform === "win32") {
        // On Windows, "start" is a shell built-in — use cmd.exe with array args to avoid injection
        spawn("cmd.exe", ["/c", "start", "", outPath], { detached: true, stdio: "ignore" }).unref();
      } else {
        const opener = process.platform === "darwin" ? "open" : "xdg-open";
        execFile(opener, [outPath]);
      }
    }
  });

// ── approve ────────────────────────────────────────────────────────────────

const approveCmd = program.command("approve").description("Approval workflow for high-risk migrations");

approveCmd
  .command("generate <ticket-id> <target>")
  .description("Generate an approval request for a migration (scans the target first)")
  .option("--by <name>", "Requester name or ID", os.userInfo().username)
  .action(async (ticketId: string, target: string, options: { by: string }) => {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: path not found — ${resolved}`);
      process.exit(1);
    }
    const config = loadConfig();
    const results = fs.statSync(resolved).isDirectory()
      ? checkDirectory(resolved, config)
      : [checkFile(resolved, config)];
    const scanResult = buildScanResult(results, loadPluginRules(config));
    const filePath = generateApprovalRequest(ticketId, target, scanResult, options.by);
    console.log(`✔ Approval request generated: ${filePath}`);
    console.log(`  Risk: ${scanResult.risk.score}/100 ${scanResult.risk.level}`);
    console.log(`  Issues: ${scanResult.totalIssues}`);
    console.log(`\nShare this file with your team lead for approval.`);
    console.log(`Once approved, run: migrasafe approve status ${ticketId}`);
  });

approveCmd
  .command("approve <ticket-id>")
  .description("Mark an approval request as approved")
  .option("--by <name>", "Approver name or ID", os.userInfo().username)
  .option("--notes <text>", "Optional approval notes", "")
  .action((ticketId: string, options: { by: string; notes: string }) => {
    try {
      approveRequest(ticketId, options.by, options.notes);
      console.log(`✔ Approval request ${ticketId} approved by ${options.by}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

approveCmd
  .command("reject <ticket-id>")
  .description("Mark an approval request as rejected")
  .option("--by <name>", "Rejector name or ID", os.userInfo().username)
  .option("--notes <text>", "Rejection reason", "")
  .action((ticketId: string, options: { by: string; notes: string }) => {
    try {
      rejectRequest(ticketId, options.by, options.notes);
      console.log(`✖ Approval request ${ticketId} rejected by ${options.by}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

approveCmd
  .command("status <ticket-id>")
  .description("Show the status of an approval request")
  .action((ticketId: string) => {
    const req = getApprovalStatus(ticketId);
    if (!req) {
      console.error(`No approval request found for ticket: ${ticketId}`);
      process.exit(1);
    }
    const chalk = require("chalk");
    const statusColor = req.status === "approved" ? chalk.green : req.status === "rejected" ? chalk.red : chalk.yellow;
    console.log(`\nApproval Request: ${req.ticketId}`);
    console.log(`  Status    : ${statusColor(req.status.toUpperCase())}`);
    console.log(`  Target    : ${req.target}`);
    console.log(`  Risk      : ${req.riskScore}/100 ${req.riskLevel}`);
    console.log(`  Issues    : ${req.totalIssues}`);
    console.log(`  Requested : ${req.createdAt} by ${req.createdBy}`);
    if (req.approvedBy) console.log(`  Resolved  : ${req.approvedAt} by ${req.approvedBy}`);
    if (req.notes) console.log(`  Notes     : ${req.notes}`);
    console.log();
    process.exit(req.status === "approved" ? 0 : 1);
  });

approveCmd
  .command("list")
  .description("List all approval requests")
  .action(() => {
    const chalk = require("chalk");
    const all = listApprovals();
    if (all.length === 0) {
      console.log("No approval requests found.");
      return;
    }
    console.log(`\n${all.length} approval request(s):\n`);
    for (const req of all) {
      const statusColor = req.status === "approved" ? chalk.green : req.status === "rejected" ? chalk.red : chalk.yellow;
      console.log(`  ${statusColor(req.status.padEnd(8))}  ${req.ticketId.padEnd(20)}  risk ${req.riskScore}/100  ${req.target}`);
    }
    console.log();
  });

// ── policy ─────────────────────────────────────────────────────────────────

const policyCmd = program.command("policy").description("Policy management");

policyCmd
  .command("check <target>")
  .description("Scan a target and evaluate it against .migrasafe-policy.json")
  .option("--dialect <dialect>", "SQL dialect", "auto")
  .action((target: string, options: { dialect: string }) => {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: path not found — ${resolved}`);
      process.exit(1);
    }
    const config = loadConfig();
    if (options.dialect) config.dialect = options.dialect as Dialect;
    const results = fs.statSync(resolved).isDirectory()
      ? checkDirectory(resolved, config)
      : [checkFile(resolved, config)];
    const scanResult = buildScanResult(results, loadPluginRules(config));

    console.log(formatText(scanResult));

    const policy = loadPolicy();
    if (!policy) {
      console.error("No .migrasafe-policy.json found. Create one to use policy checks.");
      process.exit(1);
    }
    const pr = evaluatePolicy(scanResult, policy);
    console.log(formatPolicyResult(pr));
    process.exit(pr.passed && !pr.requiresApproval ? (scanResult.safe ? 0 : 1) : 2);
  });

// ── install-hook ───────────────────────────────────────────────────────────

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
      fs.appendFileSync(hookPath, "\n" + hookScript);
      console.log("✔ migrasafe hook appended to existing pre-commit hook.");
    } else {
      fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
      console.log("✔ migrasafe pre-commit hook installed at .git/hooks/pre-commit");
    }
  });

// ── coverage ───────────────────────────────────────────────────────────────

program
  .command("coverage")
  .description("Show which SQL statement types are covered by the analysis engine")
  .option("--format <format>", "Output format: text or json", "text")
  .action((options: { format: string }) => {
    const report = generateCoverageReport();
    if (options.format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatCoverageText(report));
    }
  });

// ── catalog ────────────────────────────────────────────────────────────────

program
  .command("catalog")
  .description("Generate public rule catalog")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .option("--output <file>", "Write to file instead of stdout")
  .action((options: { format: string; output?: string }) => {
    const config = loadConfig();
    const pluginRules = loadPluginRules(config);
    const entries = buildCatalog(pluginRules);
    const output = options.format === "json"
      ? formatCatalogJson(entries)
      : formatCatalogMarkdown(entries);

    if (options.output) {
      const outPath = path.resolve(options.output);
      fs.writeFileSync(outPath, output, "utf-8");
      console.log(`✔ Catalog written to ${outPath} (${entries.length} rules)`);
    } else {
      console.log(output);
    }
  });

// ── benchmark ──────────────────────────────────────────────────────────────

program
  .command("benchmark")
  .description("Run performance benchmark suite")
  .option("--json", "Output results as JSON")
  .action((options: { json?: boolean }) => {
    const suite = runBenchmarkSuite();
    if (options.json) {
      console.log(JSON.stringify(suite, null, 2));
    } else {
      console.log(formatBenchmarkText(suite));
    }
  });

program.parse();
