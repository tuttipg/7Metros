-- 7Metros · chequeos de integridad no destructivos
-- Ejecutar sobre Supabase para verificar el estado del dataset antes/después de importaciones.

with duplicate_clubs as (
  select public.normalizar_7m(nombre) as key, count(*) as n
  from public.clubes
  group by 1
  having count(*) > 1
), duplicate_teams as (
  select club_id, temporada_id, categoria, division, rama, equipo_codigo, count(*) as n
  from public.equipos
  group by 1,2,3,4,5,6
  having count(*) > 1
), duplicate_matches as (
  select temporada_id, fecha, hora, local_equipo_id, visitante_equipo_id, count(*) as n
  from public.partidos
  group by 1,2,3,4,5
  having count(*) > 1
), invalid_refs as (
  select p.id
  from public.partidos p
  left join public.equipos l on l.id = p.local_equipo_id
  left join public.equipos v on v.id = p.visitante_equipo_id
  where l.id is null or v.id is null
), cross_scope as (
  select p.id
  from public.partidos p
  join public.equipos l on l.id = p.local_equipo_id
  join public.equipos v on v.id = p.visitante_equipo_id
  where l.temporada_id is distinct from p.temporada_id
     or v.temporada_id is distinct from p.temporada_id
     or l.categoria is distinct from v.categoria
     or l.division is distinct from v.division
     or l.rama is distinct from v.rama
), same_team as (
  select id from public.partidos where local_equipo_id = visitante_equipo_id
)
select
  (select count(*) from duplicate_clubs) as duplicate_club_groups,
  (select count(*) from duplicate_teams) as duplicate_team_groups,
  (select count(*) from duplicate_matches) as exact_duplicate_match_groups,
  (select count(*) from invalid_refs) as invalid_match_refs,
  (select count(*) from cross_scope) as cross_scope_matches,
  (select count(*) from same_team) as same_team_matches;

-- Cobertura de aliases
select
  count(*) as total_aliases,
  count(*) filter (where activo) as active_aliases,
  count(distinct club_id) filter (where activo) as clubs_with_active_alias
from public.club_aliases;

-- Conteos principales por temporada
select
  t.id as temporada_id,
  t.nombre,
  count(distinct e.id) as equipos,
  count(distinct p.id) as partidos,
  min(p.fecha) as primera_fecha,
  max(p.fecha) as ultima_fecha
from public.temporadas t
left join public.equipos e on e.temporada_id = t.id
left join public.partidos p on p.temporada_id = t.id
group by t.id, t.nombre
order by t.id;
