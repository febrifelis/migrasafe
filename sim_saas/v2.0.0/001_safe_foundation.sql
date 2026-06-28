-- 001: New SaaS tables — all safe
CREATE TABLE organizations (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(30) NOT NULL DEFAULT 'free',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workspaces (
    id              BIGSERIAL PRIMARY KEY,
    org_id          BIGINT NOT NULL REFERENCES organizations(id),
    slug            VARCHAR(100) NOT NULL,
    region          VARCHAR(20) NOT NULL DEFAULT 'ap-southeast-1',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, slug)
);

CREATE TABLE members (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    BIGINT NOT NULL REFERENCES workspaces(id),
    user_id         BIGINT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'viewer',
    invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at     TIMESTAMPTZ,
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX CONCURRENTLY idx_members_ws   ON members (workspace_id, role);
CREATE INDEX CONCURRENTLY idx_members_uid  ON members (user_id);
CREATE INDEX CONCURRENTLY idx_ws_org       ON workspaces (org_id);
