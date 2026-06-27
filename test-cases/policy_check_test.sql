-- Policy check test: should trigger CRITICAL (DROP TABLE) and HIGH (ADD NOT NULL)
-- Used in automated test for: policy check subcommand routing bug (was treating
-- "check" as the <target> argument when registered as program.command("policy check <target>"))

DROP TABLE audit_log;
ALTER TABLE users ADD COLUMN score INT NOT NULL;
