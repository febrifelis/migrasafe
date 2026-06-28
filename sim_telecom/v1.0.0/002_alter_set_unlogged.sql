-- ALTER TABLE SET UNLOGGED / SET LOGGED edge cases
-- Tests: SET UNLOGGED (data loss risk), SET LOGGED (safe)

-- SET UNLOGGED — data loss risk: WAL is bypassed, data lost on crash
ALTER TABLE call_records SET UNLOGGED;
ALTER TABLE sms_events SET UNLOGGED;

-- SET LOGGED — reverse: restores WAL, safe
ALTER TABLE call_records SET LOGGED;

-- ALTER TABLE SET (options) — safe planner tuning
ALTER TABLE subscribers SET (fillfactor = 70);
ALTER TABLE call_records SET (autovacuum_enabled = false);

-- ALTER TABLE RESET (options) — safe
ALTER TABLE subscribers RESET (fillfactor);

-- ALTER TABLE ENABLE ROW LEVEL SECURITY
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- ALTER TABLE DISABLE ROW LEVEL SECURITY
ALTER TABLE subscribers DISABLE ROW LEVEL SECURITY;

-- ALTER TABLE SET TABLESPACE — moves all data, exclusive lock
ALTER TABLE call_records SET TABLESPACE fast_ssd;
