# Changelog

All notable changes to this project will be documented in this file.

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
