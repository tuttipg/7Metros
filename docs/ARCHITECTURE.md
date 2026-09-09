# Arquitectura 7Metros

## Capas

1. **Fuentes oficiales**: programaciones y planillas Fe.Me.Bal.; videos vinculados cuando están disponibles.
2. **Ingesta**: normalización, alias, fingerprint idempotente, cola de revisión y auditoría de importación.
3. **Supabase/Postgres**: clubes, equipos, temporadas, partidos, jugadores, planteles, participaciones, lanzamientos, sanciones, acciones defensivas y videos.
4. **Analítica SQL**: vistas para resumen global, cobertura, posiciones, calidad y totales individuales.
5. **Web pública**: sitio estático ES modules que consulta la Data API con publishable key y RLS.
6. **Administración**: Supabase Auth + RLS; nunca service role en navegador.
7. **IA**: jobs privados → eventos crudos → revisión → eventos publicables.

## Entidades clave

- `clubes`: institución base.
- `equipos`: identidad deportiva por temporada/categoría/división/rama/código A-B-C-D.
- `partidos`: enfrenta equipos, no clubes; esto evita mezclar equipos B/C/D.
- `jugadores`: identidad personal estable.
- `planteles`: vínculo jugador-equipo.
- `participaciones`: estadísticas de un jugador en un partido/equipo.
- `lanzamientos`: evento ofensivo con origen, destino, resultado y contexto.
- `acciones_defensivas`: evento defensivo.
- `videos_partidos`: fuente audiovisual.
- `jugador_aliases` / `club_aliases`: resolución de nombres.
- `import_revision` / `import_runs`: trazabilidad de ingesta.
- `ai_jobs` / `ai_eventos`: procesamiento y eventos de visión por computadora.

## Seguridad

- RLS es obligatoria en recursos expuestos.
- Helpers con privilegios viven en schema `private`.
- Vistas públicas usan `security_invoker`.
- El frontend solo contiene la publishable key, que es segura únicamente porque RLS limita operaciones.
- Service role se admite solo en procesos backend/CLI con variable de entorno.
- Eventos de IA públicos requieren `revisado=true`.

## Flujo de datos

`Fe.Me.Bal. → parser → normalización/alias → fingerprint → upsert/revisión → Postgres → vistas → web`

`Video → ai_jobs → detector → tracker → identidad → eventos → ai_eventos → revisión → estadísticas derivadas`

## Principios

- El equipo es la unidad competitiva; el club es la institución.
- Una estadística ausente se muestra ausente, no como cero salvo que el dominio garantice cero.
- Todo evento avanzado debe poder volver a una fuente y, para video, a un timestamp.
- Los importadores deben ser idempotentes.
- Las páginas se generan desde datos, no con listas hardcodeadas de clubes.
