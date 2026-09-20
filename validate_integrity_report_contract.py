from pathlib import Path
import re
import sys

path = Path('docs/sql-drafts/integrity-report-hardening.sql')
errors = []
if not path.exists():
    errors.append('missing integrity report hardening draft')
else:
    sql = path.read_text(encoding='utf-8').lower()
    required = [
        'borrador no aplicado',
        "'fecha_normal','reprogramacion','planilla','manual'",
        'v_invalid_participation_refs',
        'v_participation_team_mismatch',
        'v_duplicate_participations',
        'v_invalid_participation_stats',
        'pa.goles > pa.lanzamientos',
        'where p.id is null',
        'and (j.id is null or e.id is null)',
        'revoke all on function public.integrity_report_7metros(bigint) from public, anon, authenticated',
        'grant execute on function public.integrity_report_7metros(bigint) to service_role',
        'v_ok debe exigir que todas estas métricas sean 0',
    ]
    for needle in required:
        if needle not in sql:
            errors.append(f'missing contract safeguard: {needle}')

    # Regression guard: a scoped report must never put the temporal predicate
    # before the orphan-partido predicate. If p is NULL, p.temporada_id cannot
    # resolve the scope and the corruption must be counted fail-closed.
    compact = re.sub(r'\s+', ' ', sql)
    unsafe = re.search(
        r'v_invalid_participation_refs.*?where\s*\('
        r'p_temporada_id\s+is\s+null\s+or\s+p\.temporada_id\s*=\s*p_temporada_id\)'
        r'.*?and\s*\(p\.id\s+is\s+null',
        compact,
    )
    if unsafe:
        errors.append(
            'unsafe scoped orphan check: p.temporada_id filters rows before p.id is null'
        )

    safe = re.search(
        r'v_invalid_participation_refs.*?where\s+p\.id\s+is\s+null\s+or\s*\('
        r'\s*\(p_temporada_id\s+is\s+null\s+or\s+p\.temporada_id\s*=\s*p_temporada_id\)'
        r'\s+and\s+\(j\.id\s+is\s+null\s+or\s+e\.id\s+is\s+null\)',
        compact,
    )
    if not safe:
        errors.append('missing fail-closed scoped orphan structure')

if errors:
    print('INTEGRITY REPORT CONTRACT VALIDATION FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)

print('✓ integrity report draft aligns source types and fails closed on orphan participations')
