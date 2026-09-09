-- 7Metros · reporte de integridad para el importador FEMEBAL
-- Migración aplicada en Supabase el 2026-09-09.

create or replace function public.integrity_report_7metros(p_temporada_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_duplicate_clubs bigint;
  v_duplicate_teams bigint;
  v_duplicate_matches bigint;
  v_invalid_refs bigint;
  v_cross_scope bigint;
  v_same_team bigint;
  v_active_clubs bigint;
  v_clubs_with_alias bigint;
  v_active_aliases bigint;
  v_matches bigint;
  v_missing_source bigint;
  v_ok boolean;
begin
  select count(*) into v_duplicate_clubs
  from (
    select public.normalizar_7m(nombre)
    from public.clubes
    group by 1
    having count(*) > 1
  ) x;

  select count(*) into v_duplicate_teams
  from (
    select club_id, temporada_id, categoria, division, rama, equipo_codigo
    from public.equipos
    where p_temporada_id is null or temporada_id = p_temporada_id
    group by 1,2,3,4,5,6
    having count(*) > 1
  ) x;

  select count(*) into v_duplicate_matches
  from (
    select temporada_id, fecha, hora, local_equipo_id, visitante_equipo_id
    from public.partidos
    where p_temporada_id is null or temporada_id = p_temporada_id
    group by 1,2,3,4,5
    having count(*) > 1
  ) x;

  select count(*) into v_invalid_refs
  from public.partidos p
  left join public.equipos l on l.id = p.local_equipo_id
  left join public.equipos v on v.id = p.visitante_equipo_id
  where (p_temporada_id is null or p.temporada_id = p_temporada_id)
    and (l.id is null or v.id is null);

  select count(*) into v_cross_scope
  from public.partidos p
  join public.equipos l on l.id = p.local_equipo_id
  join public.equipos v on v.id = p.visitante_equipo_id
  where (p_temporada_id is null or p.temporada_id = p_temporada_id)
    and (
      l.temporada_id is distinct from p.temporada_id
      or v.temporada_id is distinct from p.temporada_id
      or l.categoria is distinct from v.categoria
      or l.division is distinct from v.division
      or l.rama is distinct from v.rama
    );

  select count(*) into v_same_team
  from public.partidos p
  where (p_temporada_id is null or p.temporada_id = p_temporada_id)
    and p.local_equipo_id = p.visitante_equipo_id;

  select count(*) into v_active_clubs
  from public.clubes
  where activo = true;

  select count(distinct club_id), count(*)
  into v_clubs_with_alias, v_active_aliases
  from public.club_aliases
  where activo = true;

  select count(*) into v_matches
  from public.partidos p
  where p_temporada_id is null or p.temporada_id = p_temporada_id;

  select count(*) into v_missing_source
  from public.partidos p
  where (p_temporada_id is null or p.temporada_id = p_temporada_id)
    and (
      nullif(trim(coalesce(p.programacion_url, '')), '') is null
      or nullif(trim(coalesce(p.programacion_pdf_url, '')), '') is null
      or nullif(trim(coalesce(p.tipo_fuente, '')), '') is null
    );

  v_ok :=
    v_duplicate_clubs = 0
    and v_duplicate_teams = 0
    and v_duplicate_matches = 0
    and v_invalid_refs = 0
    and v_cross_scope = 0
    and v_same_team = 0
    and v_clubs_with_alias = v_active_clubs
    and v_missing_source = 0;

  return jsonb_build_object(
    'ok', v_ok,
    'temporada_id', p_temporada_id,
    'duplicate_club_groups', v_duplicate_clubs,
    'duplicate_team_groups', v_duplicate_teams,
    'exact_duplicate_match_groups', v_duplicate_matches,
    'invalid_match_refs', v_invalid_refs,
    'cross_scope_matches', v_cross_scope,
    'same_team_matches', v_same_team,
    'active_clubs', v_active_clubs,
    'clubs_with_active_alias', v_clubs_with_alias,
    'active_aliases', v_active_aliases,
    'matches', v_matches,
    'matches_missing_source_trace', v_missing_source
  );
end;
$$;

revoke all on function public.integrity_report_7metros(bigint) from public, anon, authenticated;
grant execute on function public.integrity_report_7metros(bigint) to service_role;
