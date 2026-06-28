-- 001: Logistics platform — new tables (safe)
CREATE TABLE shipments (
    id              BIGSERIAL PRIMARY KEY,
    tracking_no     VARCHAR(64) UNIQUE NOT NULL,
    origin_city     VARCHAR(100) NOT NULL,
    dest_city       VARCHAR(100) NOT NULL,
    weight_kg       NUMERIC(10,3) NOT NULL DEFAULT 0,
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE route_segments (
    id              BIGSERIAL PRIMARY KEY,
    shipment_id     BIGINT NOT NULL REFERENCES shipments(id),
    seq             INTEGER NOT NULL,
    hub_code        VARCHAR(10) NOT NULL,
    arrived_at      TIMESTAMPTZ,
    departed_at     TIMESTAMPTZ,
    UNIQUE (shipment_id, seq)
);

CREATE INDEX CONCURRENTLY idx_ship_status ON shipments (status, shipped_at DESC);
CREATE INDEX CONCURRENTLY idx_seg_hub     ON route_segments (hub_code, arrived_at);
