SET search_path TO myschema, public;
CREATE TABLE configs (id SERIAL PRIMARY KEY, key VARCHAR(100));
CREATE INDEX CONCURRENTLY idx_configs_key ON configs(key);
