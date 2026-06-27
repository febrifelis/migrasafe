/* Phase 1 */
CREATE TABLE feature_a (id SERIAL PRIMARY KEY); -- safe
-- Phase 2: DROP TABLE is risky (just a comment)
CREATE INDEX CONCURRENTLY idx_feature_a ON feature_a(id);
/* DROP TABLE feature_b; -- also a comment */
