-- Simulasi: Healthcare database besar — data pasien & rekam medis
-- patients: 100M records, medical_records: 5B records
-- Highly regulated: HIPAA/GDPR, downtime = risiko nyawa
-- Mix safe zero-downtime + dangerous patterns

-- ============================================================
-- SAFE: Zero-downtime migrations untuk healthcare
-- ============================================================

-- Tambah kolom audit aman (nullable, constant default)
ALTER TABLE patients ADD COLUMN gdpr_consent_version INT DEFAULT 1;
ALTER TABLE patients ADD COLUMN data_retention_policy VARCHAR(20) DEFAULT 'standard';
ALTER TABLE medical_records ADD COLUMN encryption_key_id UUID;
ALTER TABLE medical_records ADD COLUMN access_log_enabled BOOLEAN DEFAULT TRUE;

-- Index CONCURRENTLY (tidak block read/write)
CREATE INDEX CONCURRENTLY idx_patients_dob
    ON patients(date_of_birth) WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY idx_records_patient_date
    ON medical_records(patient_id, record_date DESC);

CREATE INDEX CONCURRENTLY idx_records_type
    ON medical_records(record_type, facility_id);

-- FK NOT VALID (safe pattern — skip scan)
ALTER TABLE medical_records
    ADD CONSTRAINT fk_records_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id) NOT VALID;

ALTER TABLE medical_records
    ADD CONSTRAINT fk_records_facility
    FOREIGN KEY (facility_id) REFERENCES facilities(id) NOT VALID;

-- Safe: VALIDATE CONSTRAINT (ShareUpdateExclusiveLock — tidak block query)
ALTER TABLE medical_records VALIDATE CONSTRAINT fk_records_patient;

-- Safe: 3-step NOT NULL pattern
ALTER TABLE patients ADD COLUMN mrn VARCHAR(20);
UPDATE patients SET mrn = 'LEGACY-' || id::TEXT WHERE mrn IS NULL;
ALTER TABLE patients ALTER COLUMN mrn SET NOT NULL;

-- Safe: DETACH PARTITION CONCURRENTLY (arsip data lama)
ALTER TABLE medical_records DETACH PARTITION records_2018 CONCURRENTLY;
ALTER TABLE medical_records DETACH PARTITION records_2019 CONCURRENTLY;

-- ============================================================
-- DANGER: Operasi berbahaya di healthcare system 24/7
-- ============================================================

-- KRITIS: ALTER COLUMN TYPE di 100M patients — downtime = pasien tidak bisa diakses
ALTER TABLE patients ALTER COLUMN id TYPE BIGINT;
ALTER TABLE patients ALTER COLUMN national_id TYPE VARCHAR(30);
ALTER TABLE medical_records ALTER COLUMN patient_id TYPE BIGINT;

-- KRITIS: ADD COLUMN NOT NULL tanpa DEFAULT di 5B records
-- INSERT baru gagal = dokter tidak bisa simpan diagnosis baru!
ALTER TABLE medical_records ADD COLUMN hl7_version SMALLINT NOT NULL;
ALTER TABLE patients ADD COLUMN icd_version CHAR(5) NOT NULL;

-- KRITIS: ADD COLUMN volatile DEFAULT di 100M patients
ALTER TABLE patients ADD COLUMN patient_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE medical_records ADD COLUMN record_uuid UUID DEFAULT gen_random_uuid();

-- KRITIS: DROP COLUMN rekam medis — data medis bisa hilang permanen!
ALTER TABLE medical_records DROP COLUMN legacy_icd9_code;
ALTER TABLE patients DROP COLUMN old_insurance_ref;

-- KRITIS: ADD PRIMARY KEY (scan 5B records)
ALTER TABLE medical_records ADD PRIMARY KEY (id);

-- KRITIS: ADD FOREIGN KEY tanpa NOT VALID (scan 5B records)
ALTER TABLE medical_records
    ADD FOREIGN KEY (doctor_id) REFERENCES doctors(id);

-- KRITIS: ADD UNIQUE di 100M patients (scan seluruh table)
ALTER TABLE patients ADD UNIQUE (national_id);
ALTER TABLE patients ADD CONSTRAINT uq_mrn UNIQUE (mrn);

-- KRITIS: DROP TRIGGER audit — compliance violation!
DROP TRIGGER IF EXISTS trg_patient_data_access ON patients;
DROP TRIGGER IF EXISTS trg_records_hipaa_log ON medical_records;

-- KRITIS: SET UNLOGGED di database healthcare — data loss on crash!
ALTER TABLE medical_records SET UNLOGGED;

-- KRITIS: VACUUM FULL di 5B records (downtime berhari-hari)
VACUUM FULL medical_records;
VACUUM FULL patients;

-- KRITIS: CLUSTER di 5B records
CLUSTER medical_records USING idx_records_patient_date;

-- KRITIS: REINDEX DATABASE healthcare
REINDEX DATABASE healthcare_prod;

-- KRITIS: REFRESH MATERIALIZED VIEW tanpa CONCURRENTLY
-- Report klinis tidak tersedia selama refresh
REFRESH MATERIALIZED VIEW patient_summary_mv;
REFRESH MATERIALIZED VIEW diagnosis_statistics_mv;

-- KRITIS: DROP VIEW (breaks sistem RIS/PACS dan EMR)
DROP VIEW IF EXISTS v_patient_full_record;
DROP VIEW IF EXISTS v_active_admissions;

-- KRITIS: RENAME TABLE — breaks semua sistem klinis
ALTER TABLE patients RENAME TO healthcare_patients;
ALTER TABLE medical_records RENAME TO clinical_records;

-- KRITIS: ALTER SYSTEM di healthcare production 24/7
ALTER SYSTEM SET max_connections = 1000;
ALTER SYSTEM SET shared_buffers = '64GB';

-- KRITIS: TRUNCATE tabel staging yang masih ada FK
TRUNCATE TABLE patient_import_staging CASCADE;

-- KRITIS: UPDATE tanpa WHERE — overwrite 100M pasien
UPDATE patients SET sync_status = 'pending';

-- KRITIS: DELETE tanpa WHERE — hapus semua antrian
DELETE FROM appointment_queue;

-- KRITIS: SET lock_timeout = 0 di sistem 24/7
SET lock_timeout = 0;
SET statement_timeout = 0;

-- KRITIS: LOCK TABLE di sistem emergency
LOCK TABLE patients IN ACCESS EXCLUSIVE MODE;
LOCK TABLE medical_records IN ACCESS EXCLUSIVE MODE;

-- KRITIS: ALTER TABLE SET TABLESPACE — pindah 5B records
ALTER TABLE medical_records SET TABLESPACE archive_cold;

-- KRITIS: DROP DATABASE — kehilangan semua data pasien!
-- DROP DATABASE healthcare_backup;  -- tidak diaktifkan, terlalu berbahaya

-- KRITIS: ALTER SCHEMA RENAME (breaks semua app klinis)
ALTER SCHEMA clinical RENAME TO medical_archive;

-- KRITIS: ALTER TYPE RENAME VALUE (breaks app yang check status)
ALTER TYPE patient_status RENAME VALUE 'ADMITTED' TO 'INPATIENT';
