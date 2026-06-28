-- Government system: comprehensive safe patterns (zero warnings expected)

-- Safe CREATE TABLE
CREATE TABLE citizens (
    id BIGSERIAL PRIMARY KEY,
    national_id VARCHAR(20) NOT NULL,
    full_name TEXT NOT NULL,
    dob DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe CONCURRENTLY indexes
CREATE UNIQUE INDEX CONCURRENTLY idx_citizens_national_id ON citizens(national_id);
CREATE INDEX CONCURRENTLY idx_citizens_dob ON citizens(dob);

-- Safe nullable ADD COLUMN
ALTER TABLE citizens ADD COLUMN middle_name TEXT;
ALTER TABLE citizens ADD COLUMN phone VARCHAR(20);

-- Safe constant DEFAULT ADD COLUMN
ALTER TABLE citizens ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE citizens ADD COLUMN verification_level INT DEFAULT 0;

-- Safe: FK NOT VALID (no table scan)
ALTER TABLE citizens
    ADD CONSTRAINT fk_citizens_region
    FOREIGN KEY (region_id) REFERENCES regions(id) NOT VALID;

-- Safe: DROP NOT NULL
ALTER TABLE citizens ALTER COLUMN phone DROP NOT NULL;

-- Safe: SET DEFAULT / DROP DEFAULT
ALTER TABLE citizens ALTER COLUMN verification_level SET DEFAULT 1;
ALTER TABLE citizens ALTER COLUMN verification_level DROP DEFAULT;

-- Safe: VALIDATE CONSTRAINT (ShareUpdateExclusiveLock only)
ALTER TABLE citizens VALIDATE CONSTRAINT fk_citizens_region;

-- Safe: DROP INDEX CONCURRENTLY
DROP INDEX CONCURRENTLY IF EXISTS idx_old_citizens;

-- Safe: FK NOT VALID + VALIDATE pattern (should produce dependency analysis note)
ALTER TABLE citizens
    ADD CONSTRAINT fk_citizens_district
    FOREIGN KEY (district_id) REFERENCES districts(id) NOT VALID;
ALTER TABLE citizens VALIDATE CONSTRAINT fk_citizens_district;

-- Safe: REINDEX INDEX CONCURRENTLY
REINDEX INDEX CONCURRENTLY idx_citizens_national_id;

-- Safe: VACUUM (no FULL)
VACUUM citizens;

-- Safe: ANALYZE
ANALYZE citizens;

-- Safe: CREATE VIEW
CREATE VIEW verified_citizens AS
    SELECT id, national_id, full_name FROM citizens WHERE is_verified = TRUE;

-- Safe: ADD CONSTRAINT PRIMARY KEY USING INDEX
CREATE UNIQUE INDEX CONCURRENTLY idx_citizens_pk ON citizens(id);
ALTER TABLE citizens ADD CONSTRAINT pk_citizens PRIMARY KEY USING INDEX idx_citizens_pk;
