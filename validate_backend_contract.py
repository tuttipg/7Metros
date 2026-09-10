from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
errors = []

integrity_rpc = ROOT / 'supabase/migrations/20260909_add_integrity_report_rpc.sql'
support = ROOT / 'supabase/migrations/20260909_version_importer_support_contract.sql'
hardening = ROOT / 'supabase/migrations/20260910_harden_importer_fail_closed_v2.sql'
explicit_context = ROOT / 'supabase/migrations/20260910_require_explicit_import_context_v2.sql'
integrity = ROOT / 'supabase_integrity_check.sql'
audit = ROOT / 'docs/importador-femebal-v8.2-audit.md'
v9 = ROOT / 'docs/importador-femebal-v9-rpc-contract.md'
importer_core = ROOT / 'n8n/importer-core.mjs'
importer_smoke = ROOT / 'n8n/importer-core-smoke.mjs'

for path in (
    integrity_rpc, support, hardening, explicit_context, integrity,
    audit, v9, importer_core, importer_smoke
):
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

if hardening.exists():
    sql = hardening.read_text(encoding='utf-8').lower()
    required = [
        'club no reconocido',
        'importador_preflight_partidos_7metros',
        'competition_season_mismatches',
        'partial_score_matches',
        'programmed_matches_with_score',
        'finished_matches_without_score',
        'unknown_source_type_matches',
        'before insert or update of competencia_id,temporada_id,local_equipo_id,visitante_equipo_id',
        'grant execute on function public.importador_preflight_partidos_7metros(jsonb) to service_role',
    ]
    for needle in required:
        if needle not in sql:
            errors.append(f'20260910 hardening migration missing safeguard: {needle}')

if explicit_context.exists():
    sql = explicit_context.read_text(encoding='utf-8').lower()
    required = [
        "v_temporada_id := nullif(trim(p->>'temporada_id'),'')::bigint",
        "v_competencia_id := nullif(trim(p->>'competencia_id'),'')::bigint",
        'p_partidos no puede estar vacío',
        'máximo de 200 elementos por lote',
        "v_tipo_fuente not in ('fecha_normal','reprogramacion')",
        'programacion_url y programacion_pdf_url son requeridas',
        'competencia_id % no corresponde a temporada %',
        'grant execute on function public.sync_partidos_7metros_bulk(jsonb) to service_role',
    ]
    for needle in required:
        if needle not in sql:
            errors.append(f'explicit importer context migration missing safeguard: {needle}')

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
    for needle in (
        'importador_contexto_7metros', 'catalogo_aliases_7metros', 'service_role',
        'importador_preflight_partidos_7metros', 'equipo_id', 'scope'
    ):
        if needle not in text:
            errors.append(f'V9 RPC contract missing dependency: {needle}')

if importer_core.exists():
    text = importer_core.read_text(encoding='utf-8')
    for needle in (
        'fixtureScopeKey', 'prioritizeFixtureSchedules',
        'local_equipo_id', 'visitante_equipo_id',
        'local_equipo_codigo', 'visitante_equipo_codigo',
        'multiples_reprogramaciones'
    ):
        if needle not in text:
            errors.append(f'n8n importer core missing safeguard: {needle}')

if importer_smoke.exists():
    text = importer_smoke.read_text(encoding='utf-8')
    for needle in (
        "categoria: 'Juveniles'",
        "tipo_fuente: 'reprogramacion'",
        'multiples_reprogramaciones',
        'assert.throws'
    ):
        if needle not in text:
            errors.append(f'n8n importer smoke missing regression case: {needle}')

if errors:
    print('BACKEND CONTRACT VALIDATION FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)

print('✓ backend contract: importer V9, fail-closed RPCs, integrity and n8n regression tests OK')
