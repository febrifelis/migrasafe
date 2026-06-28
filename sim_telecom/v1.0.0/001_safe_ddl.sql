-- Telecom migration: safe DDL (zero warnings expected)

-- Safe CREATE TABLE
CREATE TABLE subscribers (
    id BIGSERIAL PRIMARY KEY,
    msisdn VARCHAR(20) NOT NULL,
    plan_id INT,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe UNIQUE INDEX CONCURRENTLY
CREATE UNIQUE INDEX CONCURRENTLY idx_subscribers_msisdn ON subscribers(msisdn);

-- Safe partial index
CREATE INDEX CONCURRENTLY idx_subscribers_active ON subscribers(plan_id)
    WHERE activated_at IS NOT NULL;

-- Safe ADD COLUMN nullable
ALTER TABLE subscribers ADD COLUMN notes TEXT;
ALTER TABLE subscribers ADD COLUMN last_call_at TIMESTAMPTZ;

-- Safe FK NOT VALID
ALTER TABLE subscribers
    ADD CONSTRAINT fk_subscribers_plan
    FOREIGN KEY (plan_id) REFERENCES plans(id) NOT VALID;

-- Safe DROP INDEX CONCURRENTLY
DROP INDEX CONCURRENTLY IF EXISTS idx_old_msisdn;

-- Safe VALIDATE CONSTRAINT
ALTER TABLE subscribers VALIDATE CONSTRAINT fk_subscribers_plan;

-- Safe: SET DEFAULT (no scan)
ALTER TABLE subscribers ALTER COLUMN notes SET DEFAULT '';

-- Safe: DROP DEFAULT (no scan)
ALTER TABLE subscribers ALTER COLUMN notes DROP DEFAULT;
