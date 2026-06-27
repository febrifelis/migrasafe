# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-06-28

### Added — V5 Plugin API
- `plugins` field in `.migrasaferc.json` — load custom company rules from JS files
- `src/plugins/loader.ts` — validates and loads plugin rule arrays at runtime
- `examples/company-rules.js` — example plugin with 3 company-specific rules
- Plugin rules participate in risk scoring, dialect filtering, and inline ignore directives

### Added — V7 VS Code Extension (`vscode-extension/`)
- Real-time diagnostics on SQL files (debounced, runs on open/save/change)
- Error/Warning severity mapping: CRITICAL+HIGH → Error, MEDIUM+ → Warning
- Quick Fix: insert `-- migrasafe-disable-next-line RULE_ID` or suppress all rules
- Hover provider: shows rule message, suggestion, and suppress hint
- Status bar item showing live scan state and issue count
- Configurable via VS Code settings: `migrasafe.enabled`, `migrasafe.dialect`, `migrasafe.minSeverity`, `migrasafe.executablePath`

### Added — V8 AI Assistance
- `migrasafe suggest <file>` — shows safe migration patterns for every detected issue
- `migrasafe suggest --rule <RULE_ID>` — detailed safe approach + example SQL for a specific rule
- `migrasafe suggest --list` — list all available migration patterns
- 10 built-in safe migration guides covering: DROP TABLE, DROP COLUMN, ADD NOT NULL COLUMN, RENAME TABLE, RENAME COLUMN, DELETE/UPDATE without WHERE, ADD COLUMN DEFAULT, CREATE/DROP INDEX

### Added — V9 Dashboard
- `migrasafe check <target> --save-history` — appends scan result to `.migrasafe-history.ndjson`
- `migrasafe dashboard [--output file] [--open]` — generates self-contained HTML dashboard with:
  - Summary cards: total scans, safe scans, CRITICAL/HIGH totals, avg risk score
  - Risk Score Trend chart (last 30 scans, line chart via Chart.js)
  - Issue Count Trend chart (bar chart)
  - Recent scans table

### Added — V10 Enterprise
- **Policy Engine**: `.migrasafe-policy.json` — define `maxRiskScore`, `blockSeverities`, `blockedRules`, `requireApprovalAboveScore`
- `migrasafe policy check <target>` — scan + policy evaluation in one command; exits 2 on policy violation
- `migrasafe check --policy` — evaluate policy after any check
- **Approval Workflow** (`migrasafe approve`):
  - `generate <ticket-id> <target>` — scan and create an approval request in `.migrasafe-approvals/`
  - `approve <ticket-id>` / `reject <ticket-id>` — record decision with reviewer name and notes
  - `status <ticket-id>` — show approval status (exits 0 if approved, 1 otherwise)
  - `list` — list all approval requests
- **Notifications**:
  - `migrasafe check --notify-slack <url>` — send Slack Block Kit message on unsafe result
  - `migrasafe check --notify-webhook <url>` — POST JSON payload to any webhook endpoint
  - Both also configurable via `.migrasaferc.json` `notifications` field

## [1.5.0] - 2026-06-28

### Added
- `--format markdown` — Markdown report with summary table, risk table, and per-file issue table; ideal for GitHub PR comments via CI
- `--format html` — Self-contained styled HTML report with risk score, color-coded severity rows, and backup warning
- `--format sarif` — SARIF 2.1.0 output compatible with GitHub Code Scanning (`uploadSarif` action) — maps issues to rule IDs and regions

## [1.4.0] - 2026-06-28

### Added
- `Dockerfile` — multi-stage build (node:20-alpine), produces a minimal image
- `.dockerignore` — excludes dev files from Docker context
- `action.yml` — reusable GitHub Action (`uses: febrifelis/migrasafe@v1`) with inputs (path, dialect, min-severity, format) and outputs (safe, risk-score, risk-level)
- `.github/workflows/docker.yml` — auto-build and push Docker image to ghcr.io on version tags
- README: Jenkins, Azure DevOps, and Docker examples; GitHub Action reusable usage docs

## [1.3.0] - 2026-06-28

### Added
- Risk Report section in text output (only shown when issues are found):
  - **Score** (0–100): weighted by severity — CRITICAL +30, HIGH +15, MEDIUM +5; minimum raised for irreversible/data-loss operations
  - **Risk level**: LOW / MEDIUM / HIGH / CRITICAL
  - **Lock impact**: worst-case PostgreSQL lock type across all flagged statements
  - **Rollback difficulty**: easy / hard / irreversible
  - **Data loss risk**: none / possible / CERTAIN
  - Backup warning when any operation is irreversible or causes certain data loss
- Risk data included in `--format json` output (`risk` field)
- Risk metadata on all 31 rules: `lock`, `rollback`, `dataLoss` fields

## [1.2.0] - 2026-06-28

### Added
- `--dialect <postgresql|mysql|auto>` flag on `check` command — filters rules to only apply those relevant to the target database engine
- `dialect` field in `.migrasaferc.json` config
- Auto-dialect detection from SQL content signals (SERIAL/$$/$1/RETURNING for PostgreSQL; backticks/AUTO_INCREMENT/ENGINE= for MySQL)
- Context-aware WHERE clause detection for DELETE/UPDATE — uses paren-depth tracking to correctly distinguish top-level WHERE from subquery WHERE

### Improved
- `DELETE_WITHOUT_WHERE` and `UPDATE_WITHOUT_WHERE` now use a recursive clause extractor instead of a simple regex — eliminates false positives from subqueries and USING clauses

## [1.1.0] - 2026-06-28

### Added
- `migrasafe rules` command — list all rules with severity, category, dialect; supports `--severity`, `--category`, `--dialect`, `--format json` filters
- Rule metadata: each rule now has `category` (data-loss, breaking-change, performance, safety) and `dialect` (all, postgresql, mysql)
- Per-rule config overrides via `rules` field in `.migrasaferc.json` — change severity or disable individual rules
- Inline ignore directive: `-- migrasafe-disable-next-line [RULE_ID...]` to suppress rules per-statement
- Fix: statement line numbers now correctly skip comment-only lines

## [1.0.1] - 2026-06-27

### Fixed
- Downgrade chalk from v5 to v4 — chalk 5 is ESM-only and breaks on Node 18/20 in CI
- Remove duplicate `MYSQL_DROP_DATABASE` rule (already covered by `DROP_DATABASE` + `DROP_SCHEMA`)

## [1.0.0] - 2026-06-27

### Added
- Initial release
- 20 detection rules: 8 CRITICAL, 3 HIGH, 8 MEDIUM (see README for full list)
- SQL-aware statement splitter (handles single-quotes, double-quotes, dollar-quotes, line/block comments)
- Text output with colored severity indicators
- JSON output (`--format json`) for CI pipelines and scripting
- Directory scan — checks all `.sql` files sorted by name
- Exit code 0 = safe, exit code 1 = unsafe or error
- File size limit (10 MB max per file)
- Binary file guard (skips non-text files)
- Symlink protection (skips symlinks in directory scan)
- Max statement limit (10,000 statements per file)
- 138 test cases covering edge cases: string literals, dollar-quoted bodies, CRLF/BOM, CTEs, subqueries, mixed case, inline comments, and more
