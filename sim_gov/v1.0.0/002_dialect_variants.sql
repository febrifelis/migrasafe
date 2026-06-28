-- PostgreSQL-specific dialect features

-- LISTEN / NOTIFY (safe — no table impact)
LISTEN channel_name;
NOTIFY my_channel, 'payload';

-- COMMENT ON TABLE/COLUMN (safe metadata)
COMMENT ON TABLE citizens IS 'Core citizen registry';
COMMENT ON COLUMN citizens.national_id IS 'Unique government ID';

-- SECURITY LABEL (safe metadata)
-- SECURITY LABEL FOR pg_catalog ON TABLE citizens IS 'restricted';

-- CREATE RULE (can interfere with INSERT/UPDATE/DELETE — potentially dangerous)
CREATE RULE protect_citizens AS ON DELETE TO citizens DO INSTEAD NOTHING;

-- ALTER TABLE NO INHERIT (detaches from parent table)
-- Only valid for partitioned tables
-- ALTER TABLE citizens_2023 NO INHERIT citizens_archive;

-- ALTER TABLE INHERIT (attaches to parent)
-- ALTER TABLE citizens_2023 INHERIT citizens_archive;

-- CREATE PUBLICATION (replication — can affect WAL load)
-- CREATE PUBLICATION my_pub FOR TABLE citizens;

-- COPY FROM/TO (bulk load — useful in migrations)
-- COPY citizens FROM '/tmp/citizens.csv' CSV;
-- COPY citizens TO '/tmp/citizens_backup.csv' CSV;

-- BEGIN / COMMIT / ROLLBACK (transaction control — not typically flagged)
BEGIN;
COMMIT;

BEGIN;
ROLLBACK;

-- SAVEPOINT
BEGIN;
SAVEPOINT sp1;
ROLLBACK TO SAVEPOINT sp1;
RELEASE SAVEPOINT sp1;
COMMIT;

-- SET LOCAL (session-scoped, reverted at transaction end)
BEGIN;
SET LOCAL lock_timeout = 5000;
COMMIT;
