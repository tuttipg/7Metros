-- 7Metros · hardening fail-closed del importador FEMEBAL.
-- Aplicado en Supabase como harden_importer_fail_closed_v2 el 2026-09-10.

-- Un nombre de club desconocido ya no puede crear automáticamente una entidad canónica.
create or replace function public.sync_equipo_7metros(
  p_club_nombre text,
  p_temporada_id bigint,
  p_categoria text,
  p_division text,
  p_rama text,
  p_equipo_codigo text default 'A',
  p_nombre_femebal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
  v_club_id bigint;
  v_equipo_id bigint;
  v_equipo_creado boolean := false;
  v_codigo text := upper(coalesce(nullif(trim(p_equipo_codigo), ''), 'A'));
  v_rama text := upper(trim(p_rama));
  v_nombre_femebal text := coalesce(nullif(trim(p_nombre_femebal), ''), trim(p_club_nombre));
begin
  if nullif(trim(p_club_nombre), '') is null then raise exception 'club_nombre requerido'; end if;
  if p_temporada_id is null or not exists (select 1 from public.temporadas t where t.id=p_temporada_id) then
    raise exception 'temporada_id inexistente o requerido: %', p_temporada_id;
  end if;
  if nullif(trim(p_categoria), '') is null or nullif(trim(p_division), '') is null then
    raise exception 'categoria y division requeridas';
  end if;
  if v_rama not in ('M','F') then raise exception 'rama invalida: %', p_rama; end if;
  if nullif(v_codigo, '') is null then raise exception 'equipo_codigo requerido'; end if;

  v_norm := public.normalizar_7m(p_club_nombre);

  select c.id into v_club_id
  from public.clubes c
  where c.activo=true and public.normalizar_7m(c.nombre)=v_norm
  order by c.id limit 1;

  if v_club_id is null then
    select ca.club_id into v_club_id
    from public.club_aliases ca
    join public.clubes c on c.id=ca.club_id and c.activo=true
    where ca.activo=true and ca.alias_normalizado=v_norm
    order by ca.id limit 1;
  end if;

  if v_club_id is null then
    raise exception 'Club no reconocido: %. Agregar alias confirmado antes de sincronizar.', p_club_nombre;
  end if;

  insert into public.club_aliases(club_id,alias,alias_normalizado,fuente,activo)
  values (v_club_id,trim(p_club_nombre),v_norm,'importador_femebal',true)
  on conflict (alias_normalizado) do nothing;

  select e.id into v_equipo_id
  from public.equipos e
  where e.club_id=v_club_id
    and e.temporada_id=p_temporada_id
    and e.categoria=trim(p_categoria)
    and e.division=trim(p_division)
    and e.rama=v_rama
    and e.equipo_codigo=v_codigo
  limit 1;

  if v_equipo_id is null then
    insert into public.equipos(club_id,temporada_id,categoria,division,rama,equipo_codigo,nombre_femebal,activo)
    values (v_club_id,p_temporada_id,trim(p_categoria),trim(p_division),v_rama,v_codigo,v_nombre_femebal,true)
    returning id into v_equipo_id;
    v_equipo_creado := true;
  else
    update public.equipos set nombre_femebal=v_nombre_femebal,activo=true where id=v_equipo_id;
  end if;

  return jsonb_build_object(
    'club_id',v_club_id,'equipo_id',v_equipo_id,'club_creado',false,
    'equipo_creado',v_equipo_creado,'club_nombre',trim(p_club_nombre),
    'categoria',trim(p_categoria),'division',trim(p_division),'rama',v_rama,'equipo_codigo',v_codigo
  );
end;
$$;

revoke all on function public.sync_equipo_7metros(text,bigint,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.sync_equipo_7metros(text,bigint,text,text,text,text,text) to service_role;

-- El trigger valida que competencia, temporada y ambos equipos pertenezcan al mismo scope.
create or replace function public.validar_scope_partido_7metros()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_local public.equipos%rowtype;
  v_visitante public.equipos%rowtype;
  v_competencia_temporada bigint;
begin
  if new.temporada_id is null then raise exception 'temporada_id requerido para validar el partido'; end if;

  select t.competencia_id into v_competencia_temporada
  from public.temporadas t where t.id=new.temporada_id;
  if v_competencia_temporada is null then raise exception 'Temporada inexistente: %', new.temporada_id; end if;
  if new.competencia_id is null or new.competencia_id is distinct from v_competencia_temporada then
    raise exception 'competencia_id (%) no corresponde a temporada % (competencia esperada %)',
      new.competencia_id,new.temporada_id,v_competencia_temporada;
  end if;

  if new.local_equipo_id is null or new.visitante_equipo_id is null then
    raise exception 'local_equipo_id y visitante_equipo_id son requeridos';
  end if;
  if new.local_equipo_id=new.visitante_equipo_id then raise exception 'Local y visitante no pueden ser el mismo equipo'; end if;

  select * into v_local from public.equipos where id=new.local_equipo_id;
  if v_local.id is null then raise exception 'Equipo local inexistente: %',new.local_equipo_id; end if;
  select * into v_visitante from public.equipos where id=new.visitante_equipo_id;
  if v_visitante.id is null then raise exception 'Equipo visitante inexistente: %',new.visitante_equipo_id; end if;

  if v_local.temporada_id is distinct from new.temporada_id or v_visitante.temporada_id is distinct from new.temporada_id then
    raise exception 'Los equipos deben pertenecer a la temporada del partido (%)',new.temporada_id;
  end if;
  if v_local.categoria is distinct from v_visitante.categoria
     or v_local.division is distinct from v_visitante.division
     or v_local.rama is distinct from v_visitante.rama then
    raise exception 'Local y visitante deben pertenecer al mismo scope competitivo';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_scope_partido_7metros() from public, anon, authenticated;
drop trigger if exists trg_validar_scope_partido_7metros on public.partidos;
create trigger trg_validar_scope_partido_7metros
before insert or update of competencia_id,temporada_id,local_equipo_id,visitante_equipo_id
on public.partidos
for each row execute function public.validar_scope_partido_7metros();

-- Preflight V9. Es estrictamente de lectura y debe ejecutarse antes del RPC de escritura.
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

      select t.competencia_id into v_competencia_esperada from public.temporadas t where t.id=v_temporada_id;
      if v_competencia_esperada is null then raise exception 'temporada inexistente: %',v_temporada_id; end if;
      if v_competencia_id is distinct from v_competencia_esperada then raise exception 'competencia % no corresponde a temporada %',v_competencia_id,v_temporada_id; end if;

      select * into v_local from public.equipos e where e.id=v_local_id;
      select * into v_visitante from public.equipos e where e.id=v_visitante_id;
      if v_local.id is null or v_visitante.id is null then raise exception 'equipo inexistente'; end if;
      if v_local.temporada_id is distinct from v_temporada_id or v_visitante.temporada_id is distinct from v_temporada_id then raise exception 'equipo fuera de temporada'; end if;
      if v_local.categoria is distinct from v_visitante.categoria
         or v_local.division is distinct from v_visitante.division
         or v_local.rama is distinct from v_visitante.rama then
        raise exception 'cruce entre scopes competitivos distintos';
      end if;
    exception when others then
      v_invalid := v_invalid+1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'indice',v_idx,'error',sqlerrm,'local_equipo_id',v_item->>'local_equipo_id',
        'visitante_equipo_id',v_item->>'visitante_equipo_id','fecha',v_item->>'fecha'
      ));
    end;
  end loop;

  if v_invalid=0 then
    with parsed as (
      select (x->>'temporada_id')::bigint temporada_id,(x->>'local_equipo_id')::bigint local_equipo_id,
             (x->>'visitante_equipo_id')::bigint visitante_equipo_id,(x->>'fecha')::date fecha,
             nullif(x->>'hora','')::time hora,x->>'tipo_fuente' tipo_fuente
      from jsonb_array_elements(p_partidos) x
    )
    select count(*) into v_duplicate_groups from (
      select temporada_id,local_equipo_id,visitante_equipo_id,fecha,hora,tipo_fuente
      from parsed group by 1,2,3,4,5,6 having count(*)>1
    ) d;

    with parsed as (
      select (x->>'temporada_id')::bigint temporada_id,(x->>'local_equipo_id')::bigint local_equipo_id,
             (x->>'visitante_equipo_id')::bigint visitante_equipo_id,(x->>'fecha')::date fecha,
             coalesce(nullif(x->>'hora',''),'00:00')::time hora,x->>'tipo_fuente' tipo_fuente
      from jsonb_array_elements(p_partidos) x
    )
    select count(*) into v_ambiguous_pairs from (
      select temporada_id,local_equipo_id,visitante_equipo_id
      from parsed group by 1,2,3
      having count(distinct (fecha,hora))>1
         and count(distinct (case when tipo_fuente='reprogramacion' then (fecha,hora) else null end))<>1
    ) a;
  end if;

  return jsonb_build_object(
    'ok',v_invalid=0 and v_duplicate_groups=0 and v_ambiguous_pairs=0,
    'total',v_total,'invalidos',v_invalid,'duplicate_payload_groups',v_duplicate_groups,
    'ambiguous_schedule_pairs',v_ambiguous_pairs,'errores',v_errors
  );
end;
$$;

revoke all on function public.importador_preflight_partidos_7metros(jsonb) from public, anon, authenticated;
grant execute on function public.importador_preflight_partidos_7metros(jsonb) to service_role;

-- Reporte de integridad ampliado. Conserva todas las claves previas.
create or replace function public.integrity_report_7metros(p_temporada_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_duplicate_clubs bigint; v_duplicate_teams bigint; v_duplicate_matches bigint;
  v_invalid_refs bigint; v_cross_scope bigint; v_same_team bigint;
  v_active_clubs bigint; v_clubs_with_alias bigint; v_active_aliases bigint;
  v_matches bigint; v_missing_source bigint; v_competencia_mismatch bigint;
  v_partial_scores bigint; v_programmed_with_score bigint; v_finished_without_score bigint;
  v_unknown_source_type bigint; v_ok boolean;
begin
  select count(*) into v_duplicate_clubs from (select public.normalizar_7m(nombre) from public.clubes group by 1 having count(*)>1) x;
  select count(*) into v_duplicate_teams from (select club_id,temporada_id,categoria,division,rama,equipo_codigo from public.equipos where p_temporada_id is null or temporada_id=p_temporada_id group by 1,2,3,4,5,6 having count(*)>1) x;
  select count(*) into v_duplicate_matches from (select temporada_id,fecha,hora,local_equipo_id,visitante_equipo_id from public.partidos where p_temporada_id is null or temporada_id=p_temporada_id group by 1,2,3,4,5 having count(*)>1) x;
  select count(*) into v_invalid_refs from public.partidos p left join public.equipos l on l.id=p.local_equipo_id left join public.equipos v on v.id=p.visitante_equipo_id where (p_temporada_id is null or p.temporada_id=p_temporada_id) and (l.id is null or v.id is null);
  select count(*) into v_cross_scope from public.partidos p join public.equipos l on l.id=p.local_equipo_id join public.equipos v on v.id=p.visitante_equipo_id where (p_temporada_id is null or p.temporada_id=p_temporada_id) and (l.temporada_id is distinct from p.temporada_id or v.temporada_id is distinct from p.temporada_id or l.categoria is distinct from v.categoria or l.division is distinct from v.division or l.rama is distinct from v.rama);
  select count(*) into v_same_team from public.partidos p where (p_temporada_id is null or p.temporada_id=p_temporada_id) and p.local_equipo_id=p.visitante_equipo_id;
  select count(*) into v_active_clubs from public.clubes where activo=true;
  select count(distinct club_id),count(*) into v_clubs_with_alias,v_active_aliases from public.club_aliases where activo=true;
  select count(*) into v_matches from public.partidos p where p_temporada_id is null or p.temporada_id=p_temporada_id;
  select count(*) into v_missing_source from public.partidos p where (p_temporada_id is null or p.temporada_id=p_temporada_id) and (nullif(trim(coalesce(p.programacion_url,'')),'') is null or nullif(trim(coalesce(p.programacion_pdf_url,'')),'') is null or nullif(trim(coalesce(p.tipo_fuente,'')),'') is null);
  select count(*) into v_competencia_mismatch from public.partidos p join public.temporadas t on t.id=p.temporada_id where (p_temporada_id is null or p.temporada_id=p_temporada_id) and p.competencia_id is distinct from t.competencia_id;
  select count(*) into v_partial_scores from public.partidos p where (p_temporada_id is null or p.temporada_id=p_temporada_id) and ((p.goles_local is null)<>(p.goles_visitante is null));
  select count(*) into v_programmed_with_score from public.partidos p where (p_temporada_id is null or p.temporada_id=p_temporada_id) and p.estado='programado' and (p.goles_local is not null or p.goles_visitante is not null);
  select count(*) into v_finished_without_score from public.partidos p where (p_temporada_id is null or p.temporada_id=p_temporada_id) and p.estado in ('finalizado','final') and (p.goles_local is null or p.goles_visitante is null);
  select count(*) into v_unknown_source_type from public.partidos p where (p_temporada_id is null or p.temporada_id=p_temporada_id) and p.tipo_fuente is not null and p.tipo_fuente not in ('fecha_normal','reprogramacion');

  v_ok := v_duplicate_clubs=0 and v_duplicate_teams=0 and v_duplicate_matches=0
    and v_invalid_refs=0 and v_cross_scope=0 and v_same_team=0
    and v_clubs_with_alias=v_active_clubs and v_missing_source=0
    and v_competencia_mismatch=0 and v_partial_scores=0 and v_programmed_with_score=0
    and v_finished_without_score=0 and v_unknown_source_type=0;

  return jsonb_build_object(
    'ok',v_ok,'temporada_id',p_temporada_id,'duplicate_club_groups',v_duplicate_clubs,
    'duplicate_team_groups',v_duplicate_teams,'exact_duplicate_match_groups',v_duplicate_matches,
    'invalid_match_refs',v_invalid_refs,'cross_scope_matches',v_cross_scope,'same_team_matches',v_same_team,
    'active_clubs',v_active_clubs,'clubs_with_active_alias',v_clubs_with_alias,'active_aliases',v_active_aliases,
    'matches',v_matches,'matches_missing_source_trace',v_missing_source,
    'competition_season_mismatches',v_competencia_mismatch,'partial_score_matches',v_partial_scores,
    'programmed_matches_with_score',v_programmed_with_score,'finished_matches_without_score',v_finished_without_score,
    'unknown_source_type_matches',v_unknown_source_type
  );
end;
$$;

revoke all on function public.integrity_report_7metros(bigint) from public, anon, authenticated;
grant execute on function public.integrity_report_7metros(bigint) to service_role;
