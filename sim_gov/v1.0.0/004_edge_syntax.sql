-- Edge case SQL syntax variations

-- Quoted identifiers
ALTER TABLE "Citizens" ALTER COLUMN "national_id" TYPE TEXT;
ALTER TABLE "public"."Citizens" ALTER COLUMN "national_id" SET NOT NULL;

-- Schema-qualified table names
ALTER TABLE public.citizens ADD COLUMN extra_field TEXT;
ALTER TABLE archive.old_records DROP COLUMN deprecated;

-- Mixed case keywords (should all be detected)
alter table citizens add column test_col text;
ALTER TABLE citizens ADD COLUMN test_col2 TEXT NOT NULL;
Alter Table citizens Rename Column full_name To given_name;

-- Multiple semicolons / empty statements
;;;
SELECT 1;;;

-- Statements with comments
ALTER TABLE citizens -- inline comment
    ADD COLUMN notes TEXT; -- end comment

-- Block comment in statement
ALTER TABLE /* block comment */ citizens
    DROP COLUMN old_ref;

-- Very long identifiers
ALTER TABLE citizens ADD COLUMN abcdefghijklmnopqrstuvwxyz_some_very_long_column_name_here BIGINT NOT NULL;

-- ALTER TABLE with ONLY keyword
ALTER TABLE ONLY citizens ALTER COLUMN is_verified SET NOT NULL;

-- Multiple tables in FROM clause (unusual in ALTER but in SELECT)
SELECT c.id, r.name
FROM citizens c
JOIN regions r ON c.region_id = r.id
WHERE c.is_verified = TRUE;
