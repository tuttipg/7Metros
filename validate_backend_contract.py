from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
errors = []

integrity_rpc = ROOT / 'supabase/migrations/20260909_add_integrity_report_rpc.sql'
support = ROOT / 'supabase/migrations/20260909_version_importer_support_contract.sql'
integrity = ROOT / 'supabase_integrity_check.sql'
audit = ROOT / 'docs/importador-femebal-v8.2-audit.md'
v9 = ROOT / 'docs/importador-femebal-v9-rpc-contract.md'

for path in (integrity_rpc, support, integrity, audit, v9):
    if not path.exists():
        errors.append(f'missing backend contract file: {path.relative_to(ROOT)}')

if integrity_rpc.exists():
    sql = integrity_rpc.read_text(encoding='utf-8').lower()
    required = [
        'integrity_report_7metros',
        'security definer',
        'set search_path = public',
        'duplicate_club_groups',
        'duplicate_team_groups',
        'exact_duplicate_match_groups',
        'invalid_match_refs',
        'cross_scope_matches',
        'same_team_matches',
        'matches_missing_source_trace',
        'revoke all on function public.integrity_report_7metros(bigint) from public, anon, authenticated',
        'grant execute on function public.integrity_report_7metros(bigint) to service_role',
    ]
    for needle in required:
        if needle not in sql:
            errors.append(f'integrity RPC migration missing safeguard: {needle}')

if support.exists():
    sql = support.read_text(encoding='utf-8').lower()
    required = [
        'importador_contexto_7metros',
        'catalogo_aliases_7metros',
        'grant execute on function public.importador_contexto_7metros(bigint) to service_role',
        'grant execute on function public.catalogo_aliases_7metros() to service_role',
        'idx_ai_eventos_equipo',
        'idx_ai_eventos_video',
        'idx_ai_jobs_created_by',
        'idx_ai_jobs_video',
        'ai_eventos_select_anon',
        'ai_eventos_select_authenticated',
        'validar_scope_partido_7metros',
        'local y visitante no pueden ser el mismo equipo',
        'trg_validar_scope_partido_7metros',
        'revoke all on function public.validar_scope_partido_7metros() from public, anon, authenticated',
    ]
    for needle in required:
        if needle not in sql:
            errors.append(f'importer support migration missing safeguard: {needle}')

if integrity.exists():
    sql = integrity.read_text(encoding='utf-8').lower()
    for needle in (
        'duplicate_clubs', 'duplicate_teams', 'duplicate_matches',
        'invalid_refs', 'cross_scope', 'same_team', 'club_aliases'
    ):
        if needle not in sql:
            errors.append(f'supabase_integrity_check.sql missing check: {needle}')

if audit.exists():
    text = audit.read_text(encoding='utf-8').lower()
    for needle in ('idempotente', 'reprogramaciones', 'import_revision', '100%'):
        if needle not in text:
            errors.append(f'V8.2 audit missing contract concept: {needle}')

if v9.exists():
    text = v9.read_text(encoding='utf-8').lower()
    for needle in ('importador_contexto_7metros', 'catalogo_aliases_7metros', 'service_role'):
        if needle not in text:
            errors.append(f'V9 RPC contract missing dependency: {needle}')

if errors:
    print('BACKEND CONTRACT VALIDATION FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)

print('✓ backend contract: importer support, integrity RPC, SQL checks and docs OK')
