from pathlib import Path
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
        'revoke all on function public.integrity_report_7metros(bigint) from public, anon, authenticated',
        'grant execute on function public.integrity_report_7metros(bigint) to service_role',
        'v_ok debe exigir que todas estas métricas sean 0',
    ]
    for needle in required:
        if needle not in sql:
            errors.append(f'missing contract safeguard: {needle}')

if errors:
    print('INTEGRITY REPORT CONTRACT VALIDATION FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)

print('✓ integrity report draft aligns source types and covers participation integrity')
