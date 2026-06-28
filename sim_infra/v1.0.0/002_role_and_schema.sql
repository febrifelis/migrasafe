-- Role and schema operations targeting infra migrations
-- Tests: DROP ROLE, ALTER ROLE, CREATE SCHEMA, SET ROLE, GRANT/REVOKE

-- DROP ROLE — should this be flagged? It removes a principal.
DROP ROLE IF EXISTS reporting_user;
DROP ROLE old_app_service;

-- ALTER ROLE ... SET — changes session defaults for a role
ALTER ROLE app_user SET search_path TO app_schema, public;
ALTER ROLE readonly_user SET statement_timeout = '30s';

-- SET SESSION AUTHORIZATION
SET SESSION AUTHORIZATION app_admin;

-- RESET ROLE
RESET ROLE;

-- GRANT ALL on schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;

-- REVOKE
REVOKE ALL ON TABLE audit_logs FROM readonly_user;

-- CREATE SCHEMA
CREATE SCHEMA IF NOT EXISTS archive;

-- ALTER SCHEMA ... RENAME
ALTER SCHEMA old_api RENAME TO api_v1_deprecated;
