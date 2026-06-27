# migrasafe

> Detect unsafe SQL migrations before deploying to production.

Zero dependencies. Single command. Works in CI pipelines.

## Install

```bash
npm install -g migrasafe
```

## Usage

```bash
# Check a single file
migrasafe check migration.sql

# Check a directory
migrasafe check ./migrations/

# JSON output (for CI pipelines)
migrasafe check ./migrations/ --format json
```

## Example Output

```
Scanning 3 file(s)...

migrations/V2__add_status.sql
  ✖ CRITICAL  Line 3
  Statement: DROP COLUMN users.old_field
  Problem  : DROP COLUMN bersifat irreversible — data kolom akan hilang permanen.
  Fix      : Pastikan aplikasi sudah tidak mengakses kolom ini sebelum drop.

── Summary ──────────────────────────────
  CRITICAL : 1
  HIGH     : 1
  MEDIUM   : 2
  Total    : 4 issue(s) dalam 3 file

✖ UNSAFE — selesaikan issue CRITICAL/HIGH sebelum deploy
```

## Rules

| Rule | Severity |
|---|---|
| DROP TABLE | CRITICAL |
| DROP COLUMN | CRITICAL |
| TRUNCATE | CRITICAL |
| DELETE without WHERE | CRITICAL |
| UPDATE without WHERE | HIGH |
| RENAME TABLE / COLUMN | HIGH |
| ADD COLUMN NOT NULL without DEFAULT | HIGH |
| ALTER COLUMN TYPE | HIGH |
| CREATE INDEX without CONCURRENTLY | MEDIUM |
| DROP INDEX | MEDIUM |
| DROP CONSTRAINT | MEDIUM |

## CI Integration

```yaml
# GitHub Actions
- name: Check migrations
  run: npx migrasafe check ./migrations/
```

Exit code `0` = safe, `1` = unsafe.

## License

MIT
