# Changelog

All notable changes to this project will be documented in this file.

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
