-- Simulasi: Social Media Platform — graph database di PostgreSQL
-- user_connections: 50B edges (follows/friends)
-- posts: 10B rows, comments: 100B rows
-- High-traffic: 500K QPS read, 50K QPS write

-- ============================================================
-- SAFE: Zero-downtime patterns untuk social platform
-- ============================================================

-- Tambah kolom nullable dengan constant default (instant)
ALTER TABLE posts ADD COLUMN moderation_score FLOAT DEFAULT 0.0;
ALTER TABLE posts ADD COLUMN language_code CHAR(5) DEFAULT 'en';
ALTER TABLE comments ADD COLUMN reaction_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN is_verified_creator BOOLEAN DEFAULT FALSE;

-- Index CONCURRENTLY (tidak block write, tapi jalan lama)
CREATE INDEX CONCURRENTLY idx_posts_language
    ON posts(language_code, created_at DESC)
    WHERE language_code != 'en';

CREATE INDEX CONCURRENTLY idx_comments_post_active
    ON comments(post_id, created_at DESC)
    WHERE is_deleted = FALSE;

-- FK NOT VALID (skip full scan)
ALTER TABLE posts
    ADD CONSTRAINT fk_posts_author
    FOREIGN KEY (author_id) REFERENCES users(id) NOT VALID;

-- ============================================================
-- DANGER: Operasi yang MERUSAK di social platform 500K QPS
-- ============================================================

-- FATAL: ALTER COLUMN TYPE di user_connections 50B edges
-- Lock ACCESS EXCLUSIVE selama berjam-jam = platform DOWN
ALTER TABLE user_connections ALTER COLUMN follower_id TYPE BIGINT;
ALTER TABLE user_connections ALTER COLUMN following_id TYPE BIGINT;
ALTER TABLE posts ALTER COLUMN author_id TYPE BIGINT;
ALTER TABLE comments ALTER COLUMN author_id TYPE BIGINT;

-- FATAL: ADD COLUMN NOT NULL tanpa DEFAULT di posts 10B rows
-- Semua INSERT baru akan GAGAL selama migration
ALTER TABLE posts ADD COLUMN content_hash VARCHAR(64) NOT NULL;
ALTER TABLE comments ADD COLUMN thread_root_id BIGINT NOT NULL;

-- FATAL: ADD COLUMN volatile DEFAULT di 10B posts
ALTER TABLE posts ADD COLUMN post_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE comments ADD COLUMN comment_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE users ADD COLUMN session_token UUID DEFAULT gen_random_uuid();

-- FATAL: ADD PRIMARY KEY di 50B rows (validasi setiap row)
ALTER TABLE user_connections ADD PRIMARY KEY (follower_id, following_id);

-- FATAL: ADD FOREIGN KEY tanpa NOT VALID di 100B comments
ALTER TABLE comments
    ADD FOREIGN KEY (post_id) REFERENCES posts(id);
ALTER TABLE comments
    ADD FOREIGN KEY (author_id) REFERENCES users(id);

-- FATAL: DROP COLUMN — irreversible, semua historical data hilang
ALTER TABLE posts DROP COLUMN legacy_media_ref;
ALTER TABLE comments DROP COLUMN old_thread_id;
ALTER TABLE users DROP COLUMN deprecated_profile_v1;

-- FATAL: VACUUM FULL di 10B posts dan 100B comments
-- Platform akan DOWN selama berhari-hari
VACUUM FULL posts;
VACUUM FULL comments;
VACUUM FULL user_connections;

-- FATAL: CLUSTER di 50B user_connections
CLUSTER user_connections USING idx_connections_follower;

-- FATAL: REINDEX TABLE di jam sibuk
REINDEX TABLE posts;
REINDEX TABLE comments;
REINDEX SCHEMA social;

-- FATAL: REFRESH MATERIALIZED VIEW tanpa CONCURRENTLY
-- Dashboard trending/explore akan DOWN
REFRESH MATERIALIZED VIEW trending_posts_mv;
REFRESH MATERIALIZED VIEW user_feed_cache_mv;
REFRESH MATERIALIZED VIEW creator_analytics_mv;

-- FATAL: DROP TABLE — kehilangan data permanen
DROP TABLE IF EXISTS legacy_activity_log CASCADE;
DROP TABLE shadow_ban_log;

-- FATAL: TRUNCATE di tabel aktif
TRUNCATE TABLE notification_queue;
TRUNCATE TABLE posts_draft;

-- FATAL: UPDATE tanpa WHERE di 10B posts
UPDATE posts SET is_indexed = FALSE;
UPDATE comments SET is_visible = TRUE;

-- FATAL: DELETE tanpa WHERE
DELETE FROM posts_moderation_queue;

-- FATAL: RENAME TABLE — breaks semua API dan ETL
ALTER TABLE posts RENAME TO content_posts;
ALTER TABLE user_connections RENAME TO social_graph_edges;

-- FATAL: RENAME COLUMN — breaks semua query dan index
ALTER TABLE posts RENAME COLUMN author_id TO creator_id;
ALTER TABLE comments RENAME COLUMN post_id TO content_id;

-- FATAL: ALTER SYSTEM di production 500K QPS
ALTER SYSTEM SET max_connections = 5000;
ALTER SYSTEM SET shared_buffers = '128GB';

-- FATAL: LOCK TABLE di platform live
LOCK TABLE posts IN ACCESS EXCLUSIVE MODE;
LOCK TABLE user_connections IN ACCESS EXCLUSIVE MODE;

-- FATAL: SET timeout = 0 di production tinggi traffic
SET lock_timeout = 0;
SET statement_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
