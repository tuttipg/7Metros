-- 7Metros · el RPC de escritura de partidos exige contexto y trazabilidad explícitos.
-- Aplicado en Supabase como require_explicit_import_context_v2 el 2026-09-10.

create or replace function public.sync_partidos_7metros_bulk(p_partidos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  v_temporada_id bigint;
  v_competencia_id bigint;
  v_competencia_esperada bigint;
  v_local_id bigint;
  v_visitante_id bigint;
  v_fecha date;
  v_hora time;
  v_jornada integer;
  v_tipo_fuente text;
  v_programacion_url text;
  v_programacion_pdf_url text;
  v_existentes integer;
  v_partido public.partidos%rowtype;
  v_insertados integer := 0;
  v_existentes_igual integer := 0;
  v_reprogramados integer := 0;
  v_revision integer := 0;
  v_errores integer := 0;
  v_detalles jsonb := '[]'::jsonb;
  v_fingerprint text;
begin
  if p_partidos is null or jsonb_typeof(p_partidos) <> 'array' then
    raise exception 'p_partidos debe ser un array JSON';
  end if;
  if jsonb_array_length(p_partidos) = 0 then
    raise exception 'p_partidos no puede estar vacío';
  end if;
  if jsonb_array_length(p_partidos) > 200 then
    raise exception 'p_partidos excede el máximo de 200 elementos por lote';
  end if;

  for p in select value from jsonb_array_elements(p_partidos)
  loop
    begin
      v_temporada_id := nullif(trim(p->>'temporada_id'),'')::bigint;
      v_competencia_id := nullif(trim(p->>'competencia_id'),'')::bigint;
      v_local_id := nullif(trim(p->>'local_equipo_id'),'')::bigint;
      v_visitante_id := nullif(trim(p->>'visitante_equipo_id'),'')::bigint;
      v_fecha := nullif(trim(p->>'fecha'),'')::date;
      v_hora := nullif(trim(p->>'hora'),'')::time;
      v_jornada := nullif(trim(p->>'jornada'),'')::integer;
      v_tipo_fuente := nullif(trim(p->>'tipo_fuente'),'');
      v_programacion_url := nullif(trim(p->>'programacion_url'),'');
      v_programacion_pdf_url := nullif(trim(p->>'programacion_pdf_url'),'');

      if v_temporada_id is null then raise exception 'temporada_id requerido'; end if;
      if v_competencia_id is null then raise exception 'competencia_id requerido'; end if;
      if v_local_id is null or v_visitante_id is null or v_local_id <= 0 or v_visitante_id <= 0 then
        raise exception 'IDs de equipos inválidos: local %, visitante %', v_local_id, v_visitante_id;
      end if;
      if v_local_id = v_visitante_id then raise exception 'Local y visitante no pueden ser el mismo equipo: %', v_local_id; end if;
      if v_fecha is null then raise exception 'Fecha requerida'; end if;
      if v_tipo_fuente not in ('fecha_normal','reprogramacion') then raise exception 'tipo_fuente inválido: %', coalesce(v_tipo_fuente,'null'); end if;
      if v_programacion_url is null or v_programacion_pdf_url is null then raise exception 'programacion_url y programacion_pdf_url son requeridas'; end if;

      select t.competencia_id into v_competencia_esperada from public.temporadas t where t.id = v_temporada_id;
      if v_competencia_esperada is null then raise exception 'Temporada inexistente: %', v_temporada_id; end if;
      if v_competencia_id is distinct from v_competencia_esperada then
        raise exception 'competencia_id % no corresponde a temporada %', v_competencia_id, v_temporada_id;
      end if;

      if not exists (select 1 from public.equipos e where e.id=v_local_id and e.temporada_id=v_temporada_id and e.activo=true)
         or not exists (select 1 from public.equipos e where e.id=v_visitante_id and e.temporada_id=v_temporada_id and e.activo=true) then
        raise exception 'Algún equipo no existe, está inactivo o no pertenece a la temporada %', v_temporada_id;
      end if;

      if exists (
        select 1 from public.equipos l join public.equipos v on v.id=v_visitante_id
        where l.id=v_local_id
          and (l.categoria is distinct from v.categoria or l.division is distinct from v.division or l.rama is distinct from v.rama)
      ) then
        raise exception 'Local y visitante pertenecen a scopes competitivos distintos';
      end if;

      select count(*) into v_existentes
      from public.partidos x
      where x.temporada_id=v_temporada_id
        and x.local_equipo_id=v_local_id
        and x.visitante_equipo_id=v_visitante_id;

      if v_existentes = 0 then
        insert into public.partidos(
          competencia_id,temporada_id,fecha,hora,jornada,local_equipo_id,visitante_equipo_id,
          estado,goles_local,goles_visitante,observaciones,programacion_url,programacion_pdf_url,tipo_fuente,updated_at
        ) values (
          v_competencia_id,v_temporada_id,v_fecha,v_hora,v_jornada,v_local_id,v_visitante_id,
          'programado',null,null,
          coalesce(nullif(p->>'observaciones',''),'Importado automáticamente desde programación oficial FEMEBAL'),
          v_programacion_url,v_programacion_pdf_url,v_tipo_fuente,now()
        ) returning * into v_partido;
        v_insertados := v_insertados + 1;
        v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
          'accion','insertado','partido_id',v_partido.id,'local_equipo_id',v_local_id,
          'visitante_equipo_id',v_visitante_id,'fecha',v_fecha,'hora',v_hora
        ));

      elsif v_existentes = 1 then
        select * into v_partido from public.partidos x
        where x.temporada_id=v_temporada_id and x.local_equipo_id=v_local_id and x.visitante_equipo_id=v_visitante_id
        limit 1;

        if v_partido.fecha=v_fecha and coalesce(v_partido.hora::text,'')=coalesce(v_hora::text,'') then
          update public.partidos
          set jornada=coalesce(v_jornada,jornada),
              programacion_url=v_programacion_url,
              programacion_pdf_url=v_programacion_pdf_url,
              tipo_fuente=v_tipo_fuente,
              updated_at=now()
          where id=v_partido.id;
          v_existentes_igual := v_existentes_igual + 1;

        elsif v_partido.estado='programado' then
          update public.partidos
          set fecha=v_fecha,
              hora=v_hora,
              jornada=coalesce(v_jornada,jornada),
              observaciones=format(
                'Reprogramado automáticamente desde FEMEBAL. Fecha anterior: %s %s',
                v_partido.fecha,coalesce(left(v_partido.hora::text,5),'sin hora')
              ),
              programacion_url=v_programacion_url,
              programacion_pdf_url=v_programacion_pdf_url,
              tipo_fuente=v_tipo_fuente,
              updated_at=now()
          where id=v_partido.id;
          v_reprogramados := v_reprogramados + 1;
          v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
            'accion','reprogramado','partido_id',v_partido.id,
            'fecha_anterior',v_partido.fecha,'hora_anterior',v_partido.hora,
            'fecha_nueva',v_fecha,'hora_nueva',v_hora
          ));

        else
          v_revision := v_revision + 1;
          v_fingerprint := md5(concat_ws('|','partido_finalizado_fecha_distinta',v_temporada_id,v_local_id,v_visitante_id,v_fecha,v_hora));
          insert into public.import_revision(fingerprint,tipo,fuente_url,fuente_pdf_url,payload,estado,observaciones)
          values (
            v_fingerprint,'partido_finalizado_fecha_distinta',v_programacion_url,v_programacion_pdf_url,p,
            'pendiente','La programación difiere de un partido ya no programado; no se modificó automáticamente.'
          )
          on conflict (fingerprint) do update
          set payload=excluded.payload,fuente_url=excluded.fuente_url,fuente_pdf_url=excluded.fuente_pdf_url;
        end if;
      else
        v_revision := v_revision + 1;
        v_fingerprint := md5(concat_ws('|','partido_cruce_ambiguo',v_temporada_id,v_local_id,v_visitante_id,v_fecha,v_hora));
        insert into public.import_revision(fingerprint,tipo,fuente_url,fuente_pdf_url,payload,estado,observaciones)
        values (
          v_fingerprint,'partido_cruce_ambiguo',v_programacion_url,v_programacion_pdf_url,p,'pendiente',
          format('Existen %s partidos con el mismo cruce en la temporada; no se modificó automáticamente.',v_existentes)
        )
        on conflict (fingerprint) do update
        set payload=excluded.payload,fuente_url=excluded.fuente_url,fuente_pdf_url=excluded.fuente_pdf_url;
      end if;

    exception when others then
      v_errores := v_errores + 1;
      v_fingerprint := md5(concat_ws('|','error_sync_partido',coalesce(p::text,''),sqlerrm));
      insert into public.import_revision(fingerprint,tipo,fuente_url,fuente_pdf_url,payload,estado,observaciones)
      values (
        v_fingerprint,'error_sync_partido',nullif(p->>'programacion_url',''),
        nullif(p->>'programacion_pdf_url',''),p,'pendiente',sqlerrm
      )
      on conflict (fingerprint) do nothing;
    end;
  end loop;

  return jsonb_build_object(
    'total_recibidos',jsonb_array_length(p_partidos),
    'insertados',v_insertados,
    'ya_existentes',v_existentes_igual,
    'reprogramados',v_reprogramados,
    'revision',v_revision,
    'errores',v_errores,
    'detalles',v_detalles
  );
end;
$$;

revoke all on function public.sync_partidos_7metros_bulk(jsonb) from public, anon, authenticated;
grant execute on function public.sync_partidos_7metros_bulk(jsonb) to service_role;
