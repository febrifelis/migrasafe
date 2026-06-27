# Contributing to migrasafe

Thank you for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/febrifelis/migrasafe.git
cd migrasafe
npm install
npm run build
```

## Project Structure

```
src/
  checker/
    checker.ts   — file reader, statement splitter, directory scanner
    rules.ts     — detection rules + sanitize()
  output/
    formatter.ts — text and JSON output formatters
  types/
    index.ts     — TypeScript interfaces
  index.ts       — CLI entry point
test-cases/      — individual SQL test files (one scenario per file)
test-migrations/ — sample Flyway-style migration directory
```

## Adding a New Rule

1. Add a new entry to `RULES` array in `src/checker/rules.ts`:

```typescript
{
  id: "YOUR_RULE_ID",
  severity: "CRITICAL" | "HIGH" | "MEDIUM",
  pattern: /your regex/i,
  message: "Plain English description of the risk.",
  suggestion: "What the developer should do instead.",
},
```

2. Add two test files in `test-cases/`:
   - One that **triggers** the rule (expected: UNSAFE)
   - One that **does not** trigger it (expected: SAFE)

3. Add both to the test suite in the PowerShell test script.

## Rule Guidelines

- Patterns run against **sanitized** SQL (string literals and comments already stripped)
- Use `\b` word boundaries to avoid partial matches
- Use `(?!...)` negative lookahead for "without X" patterns
- Keep `message` factual — what will break and why
- Keep `suggestion` actionable — what to do instead

## Running Tests

```bash
npm run build
node dist/index.js check test-cases/safe.sql     # should exit 0
node dist/index.js check test-cases/dangerous.sql # should exit 1
```

## Submitting a Pull Request

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes and add test cases
3. Build and verify: `npm run build`
4. Open a PR with a clear description of what the rule catches and why it matters

## Reporting a Bug

Open an issue at https://github.com/febrifelis/migrasafe/issues with:
- The SQL that produced unexpected results
- Expected behavior vs actual behavior
- Your Node.js version (`node --version`)
