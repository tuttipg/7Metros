-- SAFE DRAFT ONLY. Deliberately kept outside supabase/migrations/.
-- Issue #36: reduce destructive/non-runtime privileges from public API roles.
--
-- Evidence (read-only audit, 2026-09-13):
-- - authenticated currently has TRUNCATE, TRIGGER and REFERENCES on public tables.
-- - PostgreSQL 17 MAINTAIN is also granted on almost every current public table to
--   both anon and authenticated; MAINTAIN permits VACUUM, ANALYZE, CLUSTER,
--   REFRESH MATERIALIZED VIEW, REINDEX and LOCK TABLE.
-- - default ACLs for public tables would re-grant broad privileges to future
--   objects, so revoking only existing objects would regress as schema grows.
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

-- Existing objects.
-- These capabilities are not required for ordinary Data API CRUD:
-- TRUNCATE bypasses row-level semantics and is destructive.
-- TRIGGER permits defining triggers; it is not needed to execute existing triggers.
-- REFERENCES permits creating foreign-key references; it is not needed for DML.
-- MAINTAIN permits relation maintenance/locking operations and is not needed by
-- browser/API roles.
revoke truncate, trigger, references, maintain
  on all tables in schema public
  from authenticated;

revoke maintain
  on all tables in schema public
  from anon;

-- Future objects.
-- Supabase currently has public-schema default ACLs owned by both postgres and
-- supabase_admin. Harden both owners so a later CREATE TABLE does not silently
-- restore the privileges removed above.
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from authenticated;
alter default privileges for role postgres in schema public
  revoke maintain on tables from anon;

alter default privileges for role supabase_admin in schema public
  revoke truncate, trigger, references, maintain on tables from authenticated;
alter default privileges for role supabase_admin in schema public
  revoke truncate, trigger, references, maintain on tables from anon;

commit;

-- Verification queries to run in staging immediately after applying:
--
-- 1) Existing object privileges should be gone.
-- select c.relname as object_name,
--        has_table_privilege('anon', c.oid, 'MAINTAIN') as anon_maintain,
--        has_table_privilege('authenticated', c.oid, 'MAINTAIN') as authenticated_maintain,
--        has_table_privilege('authenticated', c.oid, 'TRUNCATE') as authenticated_truncate,
--        has_table_privilege('authenticated', c.oid, 'TRIGGER') as authenticated_trigger,
--        has_table_privilege('authenticated', c.oid, 'REFERENCES') as authenticated_references
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relkind in ('r','p','m')
-- order by c.relname;
-- Expected: all audited privilege columns false.
--
-- 2) Default ACLs must no longer contain the revoked privilege letters for
--    anon/authenticated on public tables owned by postgres or supabase_admin.
--    Inspect pg_default_acl before promotion; do not rely only on current tables.
--
-- 3) Create a disposable staging-only table, verify its grants, then drop it.
--    This proves the default-privilege hardening actually survives future DDL.
--
-- Then run Security Advisor, integrity report and authenticated CRUD smoke tests
-- before considering a production migration.

-- Rollback contract (staging/testing only): restore from a captured pre-change
-- pg_default_acl + per-object privilege snapshot. Do NOT use a blanket GRANT ALL:
-- it could grant capabilities an object/role did not previously have.
