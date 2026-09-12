from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SQL_PATH = ROOT / 'docs/sql-drafts/administrative-standings-adjustments.sql'
errors = []

if not SQL_PATH.exists():
    errors.append('missing administrative standings adjustments SQL draft')
else:
    sql = SQL_PATH.read_text(encoding='utf-8').lower()
    required = [
        'borrador no aplicado',
        'create table if not exists public.administrative_standings_adjustments',
        'team_id bigint not null references public.equipos(id) on delete restrict',
        'season_id bigint not null references public.temporadas(id) on delete restrict',
        'competition_id bigint not null references public.competencias(id) on delete restrict',
        'points_delta integer not null check (points_delta <> 0)',
        'official_source text not null',
        'resolution_date date not null',
        'source_record_key text not null',
        'unique (source_record_key)',
        'reversal_of_id bigint unique references public.administrative_standings_adjustments(id) on delete restrict',
        'security invoker',
        'set search_path = public',
        'team_id % no pertenece a season_id %',
        'season_id % no pertenece a competition_id %',
        'la reversión debe conservar team/season/competition del ajuste original',
        'la reversión debe tener delta exactamente opuesto al ajuste original',
        'before insert on public.administrative_standings_adjustments',
        'alter table public.administrative_standings_adjustments enable row level security',
        'revoke all on table public.administrative_standings_adjustments from public, anon, authenticated',
        'revoke all on table public.administrative_standings_adjustments from service_role',
        'grant select, insert on table public.administrative_standings_adjustments to service_role',
        'no se concede update/delete',
    ]
    for needle in required:
        if needle not in sql:
            errors.append(f'missing persistence safeguard: {needle}')

    forbidden = [
        'grant update on table public.administrative_standings_adjustments',
        'grant delete on table public.administrative_standings_adjustments',
        'grant all on table public.administrative_standings_adjustments to anon',
        'grant all on table public.administrative_standings_adjustments to authenticated',
        'disable row level security',
        'on delete cascade',
    ]
    for needle in forbidden:
        if needle in sql:
            errors.append(f'unsafe persistence clause present: {needle}')

if errors:
    print('ADMINISTRATIVE ADJUSTMENTS PERSISTENCE VALIDATION FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)

print('✓ administrative adjustments persistence draft: fail-closed, append-only and scoped')
