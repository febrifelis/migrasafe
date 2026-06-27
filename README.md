# migrasafe

> Detect unsafe SQL migrations before deploying to production.

Zero external dependencies. Single binary. Works in any CI pipeline.

[![npm version](https://img.shields.io/npm/v/migrasafe)](https://www.npmjs.com/package/migrasafe)
[![license](https://img.shields.io/npm/l/migrasafe)](./LICENSE)

---

## The Problem

Running a bad migration in production can cause data loss, table locks, or downtime — often irreversible. `migrasafe` catches these issues **before** they reach your database.

---

## Install

```bash
# Run without installing
npx migrasafe check ./migrations/

# Or install globally
npm install -g migrasafe
```

---

## Usage

```bash
# Check a single file
migrasafe check migration.sql

# Check a directory (scans all .sql files, sorted by name)
migrasafe check ./migrations/

# JSON output — for CI pipelines and scripting
migrasafe check ./migrations/ --format json
```

**Exit codes:** `0` = safe, `1` = unsafe or error.

---

## Example Output

```
Scanning 3 file(s)...

migrations/V2__add_status.sql
  ⚠ HIGH      Line 1
  Statement: ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL
  Problem  : ADD COLUMN NOT NULL without DEFAULT will fail on non-empty tables.
  Fix      : Use 3 steps: (1) ADD COLUMN nullable, (2) backfill data, (3) SET NOT NULL.

  ✖ CRITICAL  Line 2
  Statement: DROP TABLE old_orders
  Problem  : DROP TABLE is irreversible — all data will be permanently lost.
  Fix      : Use soft-delete or rename the table first, then drop it in a later migration.

── Summary ──────────────────────────────
  CRITICAL : 1
  HIGH     : 1
  Total    : 2 issue(s) across 3 file(s)

✖ UNSAFE — resolve all CRITICAL/HIGH issues before deploying
```

---

## Rules

| Rule | Severity | Why |
|---|---|---|
| `DROP TABLE` | CRITICAL | Irreversible — all data permanently lost |
| `DROP SCHEMA` | CRITICAL | Irreversible — all tables, views, and data lost |
| `DROP COLUMN` | CRITICAL | Irreversible — column data permanently lost |
| `TRUNCATE` | CRITICAL | Deletes all rows immediately |
| `DELETE` without `WHERE` | CRITICAL | Deletes all rows |
| `UPDATE` without `WHERE` | HIGH | Modifies all rows |
| `RENAME TABLE` | HIGH | Breaking change for existing queries |
| `RENAME COLUMN` | HIGH | Breaking change for existing queries |
| `ADD COLUMN NOT NULL` without `DEFAULT` | HIGH | Fails on non-empty tables |
| `ALTER COLUMN TYPE` | HIGH | May fail if data cannot be cast |
| `ALTER COLUMN SET NOT NULL` | HIGH | Fails if any row has NULL in that column |
| `CREATE INDEX` without `CONCURRENTLY` | MEDIUM | Locks table during index build |
| `DROP INDEX` | MEDIUM | May degrade query performance |
| `DROP CONSTRAINT` | MEDIUM | Removes data validation |
| `ADD UNIQUE CONSTRAINT` | MEDIUM | Fails if duplicate values exist |
| `ADD CHECK CONSTRAINT` | MEDIUM | Fails if existing rows violate the constraint |
| `DROP SEQUENCE` | MEDIUM | May break auto-increment or application code |
| `DROP TYPE` | MEDIUM | May break columns or functions using this type |

---

## CI Integration

### GitHub Actions

```yaml
- name: Check migration safety
  run: npx migrasafe check ./migrations/
```

### GitLab CI

```yaml
check-migrations:
  script:
    - npx migrasafe check ./migrations/
```

### Pre-commit hook

```bash
#!/bin/sh
npx migrasafe check ./migrations/
```

---

## JSON Output

Use `--format json` for structured output in scripts or dashboards:

```json
{
  "safe": false,
  "summary": {
    "critical": 1,
    "high": 1,
    "medium": 0,
    "total": 2
  },
  "files": [
    {
      "file": "migrations/V2__add_status.sql",
      "issueCount": 2,
      "issues": [
        {
          "severity": "CRITICAL",
          "line": 2,
          "statement": "DROP TABLE old_orders",
          "message": "DROP TABLE is irreversible — all data will be permanently lost.",
          "suggestion": "Use soft-delete or rename the table first, then drop it in a later migration."
        }
      ]
    }
  ]
}
```

---

## What It Does NOT Flag

- `DELETE FROM table WHERE condition` — safe, has a WHERE clause
- `UPDATE table SET col = val WHERE condition` — safe, has a WHERE clause
- `CREATE INDEX CONCURRENTLY` — safe, no table lock
- Keywords inside SQL string literals or comments — ignored

---

## License

[MIT](./LICENSE) © [febrifelis](https://github.com/febrifelis)
