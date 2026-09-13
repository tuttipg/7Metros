-- SAFE DRAFT ONLY. Deliberately kept outside supabase/migrations/.
-- Issue #36: reduce destructive/non-runtime privileges from authenticated.
--
-- Evidence (read-only audit, 2026-09-13):
-- - authenticated currently has TRUNCATE, TRIGGER and REFERENCES on public tables.
-- - public browser code only performs reads.
-- - authenticated CRUD remains governed by existing RLS policies where needed.
-- - SECURITY DEFINER importer/audit RPCs are not executable by anon/authenticated.
--
-- This draft intentionally DOES NOT revoke SELECT/INSERT/UPDATE/DELETE because
-- several authenticated application flows currently have explicit RLS policies
-- for legitimate CRUD. Those privileges require separate per-flow validation.
--
-- Do not promote this file to migrations until it has been tested in a Supabase
-- development branch/staging environment with application/importer smoke tests.

begin;

-- These capabilities are not required for ordinary Data API CRUD:
-- TRUNCATE bypasses row-level semantics and is destructive.
-- TRIGGER permits defining triggers; it is not needed to execute existing triggers.
-- REFERENCES permits creating foreign-key references; it is not needed for DML.
revoke truncate, trigger, references on all tables in schema public from authenticated;

commit;

-- Verification queries to run in staging immediately after applying:
--
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where grantee = 'authenticated'
--   and table_schema = 'public'
--   and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')
-- order by table_name, privilege_type;
-- Expected: 0 rows.
--
-- Then run the existing Security Advisor, integrity report and authenticated
-- CRUD smoke tests before considering a production migration.

-- Rollback contract (staging/testing only; use only if promotion is reversed):
-- grant truncate, trigger, references on all tables in schema public to authenticated;
