create or replace function public.importador_contexto_7metros(p_temporada_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'temporada_id', t.id,
    'temporada_nombre', t.nombre,
    'anio', t.anio,
    'fase', t.fase,
    'competencia_id', t.competencia_id,
    'fecha_inicio', t.fecha_inicio,
    'fecha_fin', t.fecha_fin,
    'clubes_activos', (select count(*) from public.clubes c where c.activo = true),
    'equipos_activos_temporada', (select count(*) from public.equipos e where e.temporada_id = t.id and e.activo = true),
    'partidos_temporada', (select count(*) from public.partidos p where p.temporada_id = t.id),
    'aliases_activos', (select count(*) from public.club_aliases ca where ca.activo = true)
  )
  from public.temporadas t
  where t.id = p_temporada_id;
$$;

revoke all on function public.importador_contexto_7metros(bigint) from public, anon, authenticated;
grant execute on function public.importador_contexto_7metros(bigint) to service_role;

create or replace function public.catalogo_aliases_7metros()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'club_id', c.id,
        'club_nombre', c.nombre,
        'alias', ca.alias,
        'alias_normalizado', ca.alias_normalizado,
        'fuente', ca.fuente
      )
      order by length(ca.alias_normalizado) desc, ca.alias_normalizado
    ),
    '[]'::jsonb
  )
  from public.club_aliases ca
  join public.clubes c on c.id = ca.club_id
  where ca.activo = true
    and c.activo = true;
$$;

revoke all on function public.catalogo_aliases_7metros() from public, anon, authenticated;
grant execute on function public.catalogo_aliases_7metros() to service_role;

create index if not exists idx_ai_eventos_equipo on public.ai_eventos(equipo_id);
create index if not exists idx_ai_eventos_video on public.ai_eventos(video_id);
create index if not exists idx_ai_jobs_created_by on public.ai_jobs(created_by);
create index if not exists idx_ai_jobs_video on public.ai_jobs(video_id);

drop policy if exists ai_eventos_select_colaborador on public.ai_eventos;
drop policy if exists ai_eventos_select_publico on public.ai_eventos;
drop policy if exists ai_eventos_select_anon on public.ai_eventos;
drop policy if exists ai_eventos_select_authenticated on public.ai_eventos;

create policy ai_eventos_select_anon
on public.ai_eventos
for select
to anon
using (revisado = true);

create policy ai_eventos_select_authenticated
on public.ai_eventos
for select
to authenticated
using ((revisado = true) or public.es_colaborador());

create or replace function public.validar_scope_partido_7metros()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_local public.equipos%rowtype;
  v_visitante public.equipos%rowtype;
begin
  if new.temporada_id is null then
    raise exception 'temporada_id requerido para validar el partido';
  end if;

  if new.local_equipo_id is null or new.visitante_equipo_id is null then
    raise exception 'local_equipo_id y visitante_equipo_id son requeridos';
  end if;

  if new.local_equipo_id = new.visitante_equipo_id then
    raise exception 'Local y visitante no pueden ser el mismo equipo';
  end if;

  select * into v_local from public.equipos where id = new.local_equipo_id;
  if v_local.id is null then
    raise exception 'Equipo local inexistente: %', new.local_equipo_id;
  end if;

  select * into v_visitante from public.equipos where id = new.visitante_equipo_id;
  if v_visitante.id is null then
    raise exception 'Equipo visitante inexistente: %', new.visitante_equipo_id;
  end if;

  if v_local.temporada_id is distinct from new.temporada_id
     or v_visitante.temporada_id is distinct from new.temporada_id then
    raise exception 'Los equipos deben pertenecer a la temporada del partido (%)', new.temporada_id;
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
before insert or update of temporada_id, local_equipo_id, visitante_equipo_id
on public.partidos
for each row
execute function public.validar_scope_partido_7metros();