-- Corrige el puntaje ordinario de posiciones Fe.Me.Bal. a 3-2-1:
-- victoria = 3, empate = 2, derrota = 1.
--
-- IMPORTANTE: Fe.Me.Bal. contempla 0 puntos para no presentación. Esa excepción
-- no debe inferirse a partir del marcador. Mientras `partidos` no tenga un dato
-- explícito y trazable de no-presentación/sanción administrativa, esta vista
-- calcula únicamente el puntaje deportivo ordinario de partidos con resultado.

create or replace view public.v_standings as
with played as (
    select
        p.temporada_id,
        p.id as partido_id,
        p.local_equipo_id as equipo_id,
        p.goles_local as gf,
        p.goles_visitante as ga,
        case when p.goles_local > p.goles_visitante then 1 else 0 end as pg,
        case when p.goles_local = p.goles_visitante then 1 else 0 end as pe,
        case when p.goles_local < p.goles_visitante then 1 else 0 end as pp
    from public.partidos p
    where p.goles_local is not null
      and p.goles_visitante is not null

    union all

    select
        p.temporada_id,
        p.id as partido_id,
        p.visitante_equipo_id as equipo_id,
        p.goles_visitante as gf,
        p.goles_local as ga,
        case when p.goles_visitante > p.goles_local then 1 else 0 end as pg,
        case when p.goles_visitante = p.goles_local then 1 else 0 end as pe,
        case when p.goles_visitante < p.goles_local then 1 else 0 end as pp
    from public.partidos p
    where p.goles_local is not null
      and p.goles_visitante is not null
),
agg as (
    select
        played.temporada_id,
        played.equipo_id,
        count(*) as pj,
        sum(played.pg) as pg,
        sum(played.pe) as pe,
        sum(played.pp) as pp,
        sum(played.gf) as gf,
        sum(played.ga) as ga
    from played
    group by played.temporada_id, played.equipo_id
)
select
    e.temporada_id,
    e.id as equipo_id,
    e.club_id,
    c.nombre as club,
    e.rama,
    e.categoria,
    e.division,
    e.equipo_codigo,
    coalesce(a.pj, 0::bigint) as pj,
    coalesce(a.pg, 0::bigint) as pg,
    coalesce(a.pe, 0::bigint) as pe,
    coalesce(a.pp, 0::bigint) as pp,
    coalesce(a.gf, 0::bigint) as gf,
    coalesce(a.ga, 0::bigint) as ga,
    coalesce(a.gf, 0::bigint) - coalesce(a.ga, 0::bigint) as dif,
    coalesce(a.pg, 0::bigint) * 3
      + coalesce(a.pe, 0::bigint) * 2
      + coalesce(a.pp, 0::bigint) as puntos
from public.equipos e
join public.clubes c on c.id = e.club_id
left join agg a
  on a.temporada_id = e.temporada_id
 and a.equipo_id = e.id
where e.activo;

-- CREATE OR REPLACE VIEW puede perder las opciones de seguridad de una vista ya
-- existente. Fijamos explícitamente SECURITY INVOKER para que RLS/permisos se
-- evalúen con el rol que consulta y no con el propietario de la vista.
alter view public.v_standings set (security_invoker = true);

comment on view public.v_standings is
'Posiciones deportivas 7Metros. Puntaje ordinario Fe.Me.Bal.: victoria 3, empate 2, derrota 1. Las sanciones/no-presentaciones requieren un override explícito y trazable; no se infieren del marcador.';
