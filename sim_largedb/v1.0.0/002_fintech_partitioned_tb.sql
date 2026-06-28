-- Simulasi: Fintech database besar — tabel transaksi terpartisi
-- transactions: 10 miliar rows, partitioned by month
-- Setiap partisi ~1M-100M rows

-- ============================================================
-- SAFE: Operasi aman di partitioned table besar
-- ============================================================

-- Tambah partisi baru (safe — data baru, tidak ada lock)
CREATE TABLE transactions_2026_01 PARTITION OF transactions
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE transactions_2026_02 PARTITION OF transactions
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- ATTACH PARTITION dengan CHECK NOT VALID dulu (meminimalkan lock)
ALTER TABLE transactions_2025_12
    ADD CONSTRAINT chk_2025_12_range
    CHECK (created_at >= '2025-12-01' AND created_at < '2026-01-01') NOT VALID;

ALTER TABLE transactions ATTACH PARTITION transactions_2025_12
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- DETACH PARTITION CONCURRENTLY (non-blocking, PG14+)
ALTER TABLE transactions DETACH PARTITION transactions_2019_01 CONCURRENTLY;
ALTER TABLE transactions DETACH PARTITION transactions_2019_02 CONCURRENTLY;

-- Index CONCURRENTLY pada partisi (bukan parent — lebih aman dan cepat)
CREATE INDEX CONCURRENTLY idx_tx_2026_01_account
    ON transactions_2026_01(account_id);

CREATE INDEX CONCURRENTLY idx_tx_2026_01_status
    ON transactions_2026_01(status) WHERE status != 'COMPLETED';

-- FK NOT VALID di partisi besar
ALTER TABLE transactions_2026_01
    ADD CONSTRAINT fk_tx_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) NOT VALID;

-- ============================================================
-- DANGER: Operasi berbahaya di partitioned fintech DB
-- ============================================================

-- BERBAHAYA: DETACH PARTITION tanpa CONCURRENTLY — ACCESS EXCLUSIVE di 100M rows
ALTER TABLE transactions DETACH PARTITION transactions_2020_01;
ALTER TABLE transactions DETACH PARTITION transactions_2020_02;

-- BERBAHAYA: ADD COLUMN NOT NULL tanpa DEFAULT di parent → propagates ke semua partisi
ALTER TABLE transactions ADD COLUMN compliance_flag SMALLINT NOT NULL;

-- BERBAHAYA: ALTER COLUMN TYPE di parent — rewrite SEMUA partisi = downtime hari-harian
ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(30,8);

-- BERBAHAYA: ADD COLUMN volatile DEFAULT di parent — rewrite semua partisi
ALTER TABLE transactions ADD COLUMN tx_ref UUID DEFAULT gen_random_uuid();

-- BERBAHAYA: DROP COLUMN di parent — propagates, irreversible
ALTER TABLE transactions DROP COLUMN legacy_batch_ref;

-- BERBAHAYA: REINDEX DATABASE saat jam sibuk
REINDEX DATABASE fintech_prod;

-- BERBAHAYA: ALTER SEQUENCE di sequence yang digunakan 10M transaksi/hari
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq CYCLE;

-- BERBAHAYA: ALTER SYSTEM di production fintech
ALTER SYSTEM SET max_connections = 2000;
ALTER SYSTEM SET wal_level = 'minimal';

-- BERBAHAYA: VACUUM FULL di parent (mewarisi ke semua partisi)
VACUUM FULL transactions;

-- BERBAHAYA: DROP TABLE partisi yang masih bisa direferensi
DROP TABLE transactions_2019_01;
DROP TABLE transactions_2019_02 CASCADE;

-- BERBAHAYA: RENAME tipe enum yang dipakai di semua partisi
ALTER TYPE transaction_status RENAME VALUE 'PENDING' TO 'IN_PROGRESS';
ALTER TYPE transaction_status RENAME TO tx_state;

-- BERBAHAYA: ALTER EXTENSION di production
ALTER EXTENSION pg_partman UPDATE TO '5.1.0';

-- BERBAHAYA: DROP TRIGGER di semua partisi (compliance!)
DROP TRIGGER IF EXISTS trg_tx_audit ON transactions_2026_01;

-- BERBAHAYA: TRUNCATE tabel yang masih ada data aktif
TRUNCATE TABLE transactions_staging CASCADE;

-- BERBAHAYA: UPDATE tanpa WHERE di 10 miliar rows
UPDATE transactions SET is_reconciled = FALSE;

-- BERBAHAYA: DELETE tanpa WHERE
DELETE FROM transactions_failed;

-- BERBAHAYA: LOCK TABLE di jam sibuk
LOCK TABLE transactions IN ACCESS EXCLUSIVE MODE;

-- BERBAHAYA: SET timeout jadi 0 di environment besar
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
