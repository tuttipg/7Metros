-- 7Metros · el RPC de escritura exige preflight exitoso y único horario por cruce en el lote.
-- Aplicado en Supabase como enforce_import_preflight_atomic_v2 el 2026-09-10.

create or replace function public.importador_preflight_partidos_7metros(p_partidos jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_idx integer := 0;
  v_total integer := 0;
  v_invalid integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_temporada_id bigint;
  v_competencia_id bigint;
  v_competencia_esperada bigint;
  v_local_id bigint;
  v_visitante_id bigint;
  v_fecha date;
  v_tipo text;
  v_local public.equipos%rowtype;
  v_visitante public.equipos%rowtype;
  v_duplicate_groups bigint := 0;
  v_ambiguous_pairs bigint := 0;
begin
  if p_partidos is null or jsonb_typeof(p_partidos) <> 'array' then
    return jsonb_build_object('ok',false,'total',0,'invalidos',1,'errores',jsonb_build_array(jsonb_build_object('error','p_partidos debe ser un array JSON')));
  end if;

  v_total := jsonb_array_length(p_partidos);
  if v_total=0 then
    return jsonb_build_object('ok',false,'total',0,'invalidos',1,'errores',jsonb_build_array(jsonb_build_object('error','lote vacío')));
  end if;
  if v_total>200 then
    return jsonb_build_object('ok',false,'total',v_total,'invalidos',1,'errores',jsonb_build_array(jsonb_build_object('error','lote excede 200 partidos')));
  end if;

  for v_item in select value from jsonb_array_elements(p_partidos)
  loop
    v_idx := v_idx+1;
    begin
      v_temporada_id := nullif(trim(v_item->>'temporada_id'),'')::bigint;
      v_competencia_id := nullif(trim(v_item->>'competencia_id'),'')::bigint;
      v_local_id := nullif(trim(v_item->>'local_equipo_id'),'')::bigint;
      v_visitante_id := nullif(trim(v_item->>'visitante_equipo_id'),'')::bigint;
      v_fecha := nullif(trim(v_item->>'fecha'),'')::date;
      v_tipo := nullif(trim(v_item->>'tipo_fuente'),'');

      if v_temporada_id is null then raise exception 'temporada_id requerido'; end if;
      if v_competencia_id is null then raise exception 'competencia_id requerido'; end if;
      if v_local_id is null or v_visitante_id is null or v_local_id<=0 or v_visitante_id<=0 then raise exception 'IDs de equipos inválidos'; end if;
      if v_local_id=v_visitante_id then raise exception 'Local y visitante no pueden ser el mismo equipo'; end if;
      if v_fecha is null then raise exception 'fecha requerida'; end if;
      if v_tipo not in ('fecha_normal','reprogramacion') then raise exception 'tipo_fuente inválido: %',coalesce(v_tipo,'null'); end if;
      if nullif(trim(coalesce(v_item->>'programacion_url','')),'') is null then raise exception 'programacion_url requerida'; end if;
      if nullif(trim(coalesce(v_item->>'programacion_pdf_url','')),'') is null then raise exception 'programacion_pdf_url requerida'; end if;

      select t.competencia_id into v_competencia_esperada
      from public.temporadas t
      where t.id=v_temporada_id;
      if v_competencia_esperada is null then raise exception 'temporada inexistente: %',v_temporada_id; end if;
      if v_competencia_id is distinct from v_competencia_esperada then raise exception 'competencia % no corresponde a temporada %',v_competencia_id,v_temporada_id; end if;

      select * into v_local from public.equipos e where e.id=v_local_id and e.activo=true;
      select * into v_visitante from public.equipos e where e.id=v_visitante_id and e.activo=true;
      if v_local.id is null or v_visitante.id is null then raise exception 'equipo inexistente o inactivo'; end if;
      if v_local.temporada_id is distinct from v_temporada_id or v_visitante.temporada_id is distinct from v_temporada_id then raise exception 'equipo fuera de temporada'; end if;
      if v_local.categoria is distinct from v_visitante.categoria
         or v_local.division is distinct from v_visitante.division
         or v_local.rama is distinct from v_visitante.rama then
        raise exception 'cruce entre scopes competitivos distintos';
      end if;
    exception when others then
      v_invalid := v_invalid+1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'indice',v_idx,'error',sqlerrm,
        'local_equipo_id',v_item->>'local_equipo_id',
        'visitante_equipo_id',v_item->>'visitante_equipo_id',
        'fecha',v_item->>'fecha'
      ));
    end;
  end loop;

  if v_invalid=0 then
    with parsed as (
      select (x->>'temporada_id')::bigint temporada_id,
             (x->>'local_equipo_id')::bigint local_equipo_id,
             (x->>'visitante_equipo_id')::bigint visitante_equipo_id,
             (x->>'fecha')::date fecha,
             coalesce(nullif(x->>'hora',''),'00:00')::time hora,
             x->>'tipo_fuente' tipo_fuente
      from jsonb_array_elements(p_partidos) x
    )
    select count(*) into v_duplicate_groups
    from (
      select temporada_id,local_equipo_id,visitante_equipo_id,fecha,hora,tipo_fuente
      from parsed
      group by 1,2,3,4,5,6
      having count(*)>1
    ) d;

    -- La entrada al RPC de escritura debe estar ya priorizada: un solo horario
    -- por cruce direccional. Un normal + reprogramación sin resolver se rechaza.
    with parsed as (
      select (x->>'temporada_id')::bigint temporada_id,
             (x->>'local_equipo_id')::bigint local_equipo_id,
             (x->>'visitante_equipo_id')::bigint visitante_equipo_id,
             (x->>'fecha')::date fecha,
             coalesce(nullif(x->>'hora',''),'00:00')::time hora
      from jsonb_array_elements(p_partidos) x
    )
    select count(*) into v_ambiguous_pairs
    from (
      select temporada_id,local_equipo_id,visitante_equipo_id
      from parsed
      group by 1,2,3
      having count(distinct (fecha,hora))>1
    ) a;
  end if;

  return jsonb_build_object(
    'ok',v_invalid=0 and v_duplicate_groups=0 and v_ambiguous_pairs=0,
    'total',v_total,
    'invalidos',v_invalid,
    'duplicate_payload_groups',v_duplicate_groups,
    'ambiguous_schedule_pairs',v_ambiguous_pairs,
    'errores',v_errors
  );
end;
$$;

revoke all on function public.importador_preflight_partidos_7metros(jsonb) from public, anon, authenticated;
grant execute on function public.importador_preflight_partidos_7metros(jsonb) to service_role;

-- Conservar la implementación validada y envolverla con preflight atómico.
alter function public.sync_partidos_7metros_bulk(jsonb) rename to sync_partidos_7metros_bulk_impl_v2;
revoke all on function public.sync_partidos_7metros_bulk_impl_v2(jsonb) from public, anon, authenticated;

create or replace function public.sync_partidos_7metros_bulk(p_partidos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preflight jsonb;
begin
  v_preflight := public.importador_preflight_partidos_7metros(p_partidos);
  if coalesce((v_preflight->>'ok')::boolean,false) is not true then
    raise exception 'Preflight FEMEBAL rechazado: %',v_preflight;
  end if;
  return public.sync_partidos_7metros_bulk_impl_v2(p_partidos);
end;
$$;

revoke all on function public.sync_partidos_7metros_bulk(jsonb) from public, anon, authenticated;
grant execute on function public.sync_partidos_7metros_bulk(jsonb) to service_role;
grant execute on function public.sync_partidos_7metros_bulk_impl_v2(jsonb) to service_role;
