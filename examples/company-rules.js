/**
 * Example migrasafe plugin — company-specific rules.
 *
 * Usage in .migrasaferc.json:
 *   { "plugins": ["./examples/company-rules.js"] }
 *
 * Each rule must export an object (or array of objects) matching the Rule interface:
 *   id, severity, pattern (RegExp), message, suggestion?,
 *   category, dialect, lock, rollback, dataLoss
 */

module.exports = [
  {
    id: "COMPANY_NO_SERIAL",
    severity: "HIGH",
    category: "safety",
    dialect: "postgresql",
    lock: "none",
    rollback: "easy",
    dataLoss: "none",
    pattern: /\bSERIAL\b/i,
    message: "Use BIGINT with a sequence instead of SERIAL — SERIAL causes issues with pg_dump and table inheritance.",
    suggestion: "CREATE SEQUENCE ...; ALTER TABLE t ALTER COLUMN id SET DEFAULT nextval('...')",
  },
  {
    id: "COMPANY_NO_PUBLIC_SCHEMA",
    severity: "MEDIUM",
    category: "safety",
    dialect: "postgresql",
    lock: "none",
    rollback: "easy",
    dataLoss: "none",
    pattern: /\bCREATE\s+TABLE\s+public\./i,
    message: "Tables must be created in the 'app' schema, not 'public'.",
    suggestion: "Use CREATE TABLE app.table_name (...) instead.",
  },
  {
    id: "COMPANY_REQUIRE_UPDATED_AT",
    severity: "MEDIUM",
    category: "safety",
    dialect: "all",
    lock: "none",
    rollback: "easy",
    dataLoss: "none",
    pattern: /\bCREATE\s+TABLE\b(?![\s\S]*\bupdated_at\b)/i,
    message: "New tables should include an 'updated_at' column for auditing.",
    suggestion: "Add: updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
];
