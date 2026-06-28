-- 001: Media platform schema — new tables (safe)
CREATE TABLE content_items (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(200) UNIQUE NOT NULL,
    title       VARCHAR(500) NOT NULL,
    kind        VARCHAR(30) NOT NULL DEFAULT 'article',
    author_id   BIGINT NOT NULL,
    published   BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    word_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content_tags (
    content_id  BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    tag         VARCHAR(100) NOT NULL,
    PRIMARY KEY (content_id, tag)
);

CREATE INDEX CONCURRENTLY idx_content_author   ON content_items (author_id, published_at DESC);
CREATE INDEX CONCURRENTLY idx_content_kind     ON content_items (kind, published) WHERE published = TRUE;
