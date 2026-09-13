-- 7Metros — BORRADOR NO APLICADO
-- Corrige desalineación de tipo_fuente y amplía integrity_report_7metros con controles de participaciones.
-- NO aplicar a producción sin staging, advisors e integrity checks antes/después.

-- Contrato objetivo (resumen verificable):
-- 1) tipo_fuente válido debe coincidir con el CHECK actual de partidos:
--    fecha_normal, reprogramacion, planilla, manual.
-- 2) el reporte debe incluir y hacer fallar ok ante:
--    - participaciones huérfanas de partido/jugador/equipo;
--    - equipo de participación ajeno al partido;
--    - duplicados lógicos partido_id + jugador_id;
--    - goles > lanzamientos cuando ambos no son null;
--    - valores negativos de goles/lanzamientos.
-- 3) conservar SECURITY DEFINER, search_path fijo y EXECUTE sólo para service_role.
-- 4) el reporte scoped debe ser fail-closed ante una participación cuyo partido no existe:
--    no puede depender de p.temporada_id para decidir si cuenta un huérfano de partido,
--    porque precisamente p es NULL en ese caso.

-- Fragmentos que deberán integrarse en la próxima versión de public.integrity_report_7metros:

-- tipo_fuente (alineado con constraint partidos_tipo_fuente_check)
-- select count(*) into v_unknown_source_type
-- from public.partidos p
-- where (p_temporada_id is null or p.temporada_id=p_temporada_id)
--   and p.tipo_fuente is not null
--   and p.tipo_fuente not in ('fecha_normal','reprogramacion','planilla','manual');

-- participaciones huérfanas / fuera de scope
-- IMPORTANTE: p.id is null va fuera del filtro temporal para no ocultar corrupción
-- cuando integrity_report_7metros se ejecuta con p_temporada_id no nulo.
-- select count(*) into v_invalid_participation_refs
-- from public.participaciones pa
-- left join public.partidos p on p.id=pa.partido_id
-- left join public.jugadores j on j.id=pa.jugador_id
-- left join public.equipos e on e.id=pa.equipo_id
-- where p.id is null
--    or (
--      (p_temporada_id is null or p.temporada_id=p_temporada_id)
--      and (j.id is null or e.id is null)
--    );

-- select count(*) into v_participation_team_mismatch
-- from public.participaciones pa
-- join public.partidos p on p.id=pa.partido_id
-- where (p_temporada_id is null or p.temporada_id=p_temporada_id)
--   and pa.equipo_id not in (p.local_equipo_id,p.visitante_equipo_id);

-- select count(*) into v_duplicate_participations
-- from (
--   select pa.partido_id, pa.jugador_id
--   from public.participaciones pa
--   join public.partidos p on p.id=pa.partido_id
--   where p_temporada_id is null or p.temporada_id=p_temporada_id
--   group by 1,2 having count(*)>1
-- ) d;

-- select count(*) into v_invalid_participation_stats
-- from public.participaciones pa
-- join public.partidos p on p.id=pa.partido_id
-- where (p_temporada_id is null or p.temporada_id=p_temporada_id)
--   and (
--     pa.goles < 0 or pa.lanzamientos < 0
--     or (pa.goles is not null and pa.lanzamientos is not null and pa.goles > pa.lanzamientos)
--   );

-- Mantener fail-closed:
-- v_ok debe exigir que todas estas métricas sean 0.
-- El JSON debe exponerlas para diagnóstico.

-- Seguridad obligatoria al materializar la migración:
-- revoke all on function public.integrity_report_7metros(bigint) from public, anon, authenticated;
-- grant execute on function public.integrity_report_7metros(bigint) to service_role;
