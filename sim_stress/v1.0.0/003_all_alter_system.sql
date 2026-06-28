-- Stress test: ALTER SYSTEM variants — test RESET vs SET severity

-- CRITICAL: SET (modifies postgresql.conf)
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- MEDIUM: RESET (reverts to default — still needs reload but less risky)
ALTER SYSTEM RESET max_connections;
ALTER SYSTEM RESET shared_buffers;
ALTER SYSTEM RESET work_mem;
ALTER SYSTEM RESET max_wal_size;
ALTER SYSTEM RESET wal_level;
ALTER SYSTEM RESET log_min_duration_statement;
ALTER SYSTEM RESET ALL;
