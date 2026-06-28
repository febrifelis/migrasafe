-- 001: Healthcare schema — new tables (safe)
CREATE TABLE patients (
    id              BIGSERIAL PRIMARY KEY,
    mrn             VARCHAR(32) UNIQUE NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    birth_date      DATE NOT NULL,
    gender          CHAR(1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE encounters (
    id              BIGSERIAL PRIMARY KEY,
    patient_id      BIGINT NOT NULL REFERENCES patients(id),
    encounter_type  VARCHAR(30) NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    facility_id     INTEGER NOT NULL
);

CREATE INDEX CONCURRENTLY idx_enc_patient  ON encounters (patient_id, started_at DESC);
CREATE INDEX CONCURRENTLY idx_enc_facility ON encounters (facility_id, started_at DESC);
