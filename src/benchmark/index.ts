import fs from "fs";
import path from "path";
import { checkFile, buildScanResult } from "../checker/checker";
import { MigrasafeConfig } from "../config";

export interface BenchmarkResult {
  label: string;
  statements: number;
  fileSizeKB: number;
  durationMs: number;
  statementsPerSecond: number;
  issues: number;
}

export interface BenchmarkSuite {
  timestamp: string;
  nodeVersion: string;
  results: BenchmarkResult[];
  summary: {
    totalStatements: number;
    totalMs: number;
    avgStatementsPerSecond: number;
  };
}

function generateSql(statementCount: number): string {
  const patterns = [
    "ALTER TABLE users ADD COLUMN last_login TIMESTAMP;",
    "CREATE INDEX CONCURRENTLY idx_users_email ON users(email);",
    "UPDATE orders SET processed = true WHERE status = 'pending';",
    "ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(12,4);",
    "DELETE FROM sessions WHERE expires_at < NOW();",
    "CREATE TABLE audit_log (id SERIAL PRIMARY KEY, action TEXT, created_at TIMESTAMPTZ DEFAULT NOW());",
    "ALTER TABLE users ADD COLUMN nickname VARCHAR(100) NOT NULL;",
    "DROP TABLE temp_import_20240101;",
    "ALTER TABLE orders RENAME COLUMN total TO total_amount;",
    "REINDEX TABLE orders;",
  ];
  const lines: string[] = [];
  for (let i = 0; i < statementCount; i++) {
    lines.push(patterns[i % patterns.length]);
  }
  return lines.join("\n");
}

function runOne(label: string, sql: string, config: MigrasafeConfig): BenchmarkResult {
  const tmpFile = path.join(require("os").tmpdir(), `migrasafe-bench-${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, sql, "utf-8");

  const fileSizeKB = Buffer.byteLength(sql, "utf-8") / 1024;

  const start = process.hrtime.bigint();
  const result = checkFile(tmpFile, config);
  buildScanResult([result]);
  const end = process.hrtime.bigint();

  fs.rmSync(tmpFile, { force: true });

  const durationMs = Number(end - start) / 1_000_000;
  const statementCount = sql.split(";").filter((s) => s.trim()).length;
  const statementsPerSecond = statementCount / (durationMs / 1000);

  return {
    label,
    statements: statementCount,
    fileSizeKB: Math.round(fileSizeKB * 10) / 10,
    durationMs: Math.round(durationMs * 10) / 10,
    statementsPerSecond: Math.round(statementsPerSecond),
    issues: result.issues.length,
  };
}

export function runBenchmarkSuite(config: MigrasafeConfig = {}): BenchmarkSuite {
  const cases: Array<{ label: string; count: number }> = [
    { label: "tiny (10 statements)",    count: 10 },
    { label: "small (100 statements)",  count: 100 },
    { label: "medium (500 statements)", count: 500 },
    { label: "large (1000 statements)", count: 1000 },
    { label: "xlarge (2000 statements)", count: 2000 },
  ];

  const results: BenchmarkResult[] = [];
  for (const c of cases) {
    const sql = generateSql(c.count);
    results.push(runOne(c.label, sql, config));
  }

  const totalStatements = results.reduce((s, r) => s + r.statements, 0);
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0);
  const avgStatementsPerSecond = Math.round(totalStatements / (totalMs / 1000));

  return {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    results,
    summary: { totalStatements, totalMs: Math.round(totalMs), avgStatementsPerSecond },
  };
}

export function formatBenchmarkText(suite: BenchmarkSuite): string {
  const lines: string[] = [
    "\nMigraSafe Benchmark Suite",
    `Run at: ${suite.timestamp}  Node: ${suite.nodeVersion}`,
    "─────────────────────────────────────────────────────────────────",
    "  Scenario                      Stmts    Size    Time     Stmts/s",
    "  ─────────────────────────────────────────────────────────────",
  ];
  for (const r of suite.results) {
    lines.push(
      `  ${r.label.padEnd(30)} ${String(r.statements).padStart(5)}  ` +
      `${(r.fileSizeKB + " KB").padStart(7)}  ${(r.durationMs + " ms").padStart(8)}  ` +
      `${String(r.statementsPerSecond).padStart(8)}`
    );
  }
  lines.push(
    "  ─────────────────────────────────────────────────────────────",
    `  Total: ${suite.summary.totalStatements} statements in ${suite.summary.totalMs} ms`,
    `  Average throughput: ${suite.summary.avgStatementsPerSecond} statements/second`,
    ""
  );
  return lines.join("\n");
}
