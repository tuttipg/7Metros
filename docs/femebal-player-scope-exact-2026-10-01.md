# FEMEBAL → jugadores: resolución exacta de scope

Fecha: 2026-10-01

## Objetivo

Resolver sin mezcla de planteles:

`club + temporada + categoría + división + rama → jugadores`

En 7Metros la relación canónica es:

`scope → equipos.id → planteles.equipo_id → jugadores.id`

El frontend ya modela `equipos` con `club_id`, `temporada_id`, `categoria`, `division`, `rama`, `equipo_codigo` y `nombre_femebal`, y `planteles` enlaza `equipo_id` con `jugador_id`, dorsal y posición.

## Regla de exactitud

La clave solicitada de cinco dimensiones se usa como primer filtro exacto:

- `club_id`
- `temporada_id`
- `categoria`
- `division`
- `rama`

No se usa fuzzy matching para decidir el plantel.

Fe.Me.Bal. documenta para 2026 que un club puede inscribir más de un equipo en una misma categoría, identificados como A/B/C/D, y que esa letra es independiente de la división en la que participe. Por eso las cinco dimensiones no deben asumirse universalmente únicas.

Si el filtro de cinco dimensiones devuelve:

- 0 equipos → `equipo_no_resuelto`;
- 1 equipo → `resolved`;
- más de 1 equipo → `scope_ambiguo`, sin devolver ni mezclar jugadores; se exige `equipo_codigo` como discriminador adicional.

La clave efectiva pasa a ser, sólo cuando sea necesario:

`club + temporada + categoría + división + rama + equipo_codigo`

## Resolución de jugadores

Una vez resuelto un único `equipos.id`:

1. seleccionar únicamente filas de `planteles` cuyo `equipo_id` coincida;
2. resolver cada `planteles.jugador_id` contra `jugadores.id`;
3. conservar dorsal y posición como atributos del vínculo jugador-equipo;
4. fallar cerrado ante referencias de jugador inexistentes o el mismo jugador duplicado dentro del mismo plantel.

No se deben inferir jugadores por club, por apellido/nombre ni por participación en otro equipo.

## Fuentes FEMEBAL y significado

### LarrySport — asignación jugador-equipo

El manual oficial enlazado por Fe.Me.Bal. muestra la pantalla `Asignación Jugador-Equipo`: selecciona Club, Temporada, Categoría y Equipo, muestra `Jugadores en el equipo` y permite imprimir el listado de jugadores asignados a ese equipo en PDF.

Esta es evidencia del modelo canónico de pertenencia de plantel, pero la pantalla pertenece al sistema de responsable de club y requiere credenciales legítimas. No se considera una fuente pública anónima para automatización.

Fuentes oficiales:

- https://femebal.com/boletin-informativo-no-10/
- https://femebal.com/wp-content/uploads/2026/01/Boletin-Informativo-No-10C.-Tutorial-LarrySport-Manual-Sistema-Clubes-2026_compressed.pdf
- https://www.femebal.com/wp-content/uploads/2026/01/Boletin-Informativo-N%C2%B0-10B.-Instructivo-de-inscripcion-de-equipos.-Ano-2026-1.pdf

### Planillas de partido

El parser actual de planillas oficiales recupera por cada partido categoría/división, equipos y jugadores participantes con dorsal, nombre, goles y sanciones.

Una planilla prueba que un jugador participó en ese partido. La unión de planillas puede construir `jugadores_observados`, pero no demuestra por sí sola el plantel completo asignado de la temporada: un jugador asignado puede no haber participado todavía.

Por lo tanto:

- `assigned_roster`: sólo cuando exista evidencia de asignación al equipo;
- `observed_match_players`: jugadores vistos en planillas oficiales;
- nunca promover automáticamente `observed_match_players` a plantel completo.

### FEMEBAL Community

La aplicación oficial anuncia información de equipos/clubes y estadísticas de jugadores. El discovery actual conserva únicamente rutas públicas verificadas; una ruta protegida (401/403) no se usa ni se intenta autenticar. Todavía no hay en el repositorio un endpoint público, anónimo y reproducible validado que entregue el plantel completo por equipo.

## Implementación

- `n8n/player-scope-core.mjs`
  - `resolveEquipoExact(equipos, scope)`
  - `resolveJugadoresExact(dataset, scope)`
- `n8n/player-scope-core-smoke.mjs`

El smoke incluye un caso deliberadamente ambiguo A/B para demostrar que el resolver no mezcla planteles, además de casos resuelto, inexistente e integridad rota.

No se realizan escrituras en Supabase ni se usan credenciales FEMEBAL.
