# Integración FEMEBAL — coordinación de resultados, partidos y clubes

Fecha: 2026-11-08  
Rama: `automation/femebal-public-discovery-safe-v3` (PR #34)  
Alcance: coordinación e integración SAFE/DRY RUN. Sin Supabase, sin importación masiva, sin producción.

## 1. Baseline coordinado

Los frentes especializados reportan como baseline actual de Clausura 2026:

- 2.689 partidos registrados;
- 0 partidos con marcador completo;
- los 2.689 aparecen actualmente como programados en la base;
- 107 clubes dentro del alcance de temporada;
- 19 clubes sin `logo_url`;
- 88 clubes con `logo_url`;
- existe además un subconjunto todavía no cuantificado aquí de URLs presentes que no renderizan correctamente en la web.

Estos números se usan como **baseline de coordinación**, no como constantes del importador. Los tests del core verifican que el resumen se calcule a partir de inputs y no hardcodean reglas universales de cantidad.

## 2. Estado real del repositorio

### main

`main` está en `33807a7de814e83f2660b4d224a7086b371455a6`.

La web actual ya:

- lee `clubes.logo_url`;
- usa `clubBadge()` con fallback por iniciales cuando falta URL o falla la imagen;
- normaliza visualmente escudos con `object-fit: contain`;
- conserva la lógica histórica que no debe tratar `programado` como un resultado.

### PR #75 — resultados en la web

Existe un PR web separado, #75, que ya consolida la corrección canónica para no mostrar 0–0 ficticios:

- un resultado requiere ambos marcadores enteros no negativos;
- `Programado`, `Sin resultado` y `Finalizado` quedan diferenciados;
- no cuenta como resultado un partido sin ambos goles;
- no fue fusionado a `main`;
- requiere aprobación/revisión humana independiente.

El PR #34 **no duplica** esa presentación web.

### PR #34

Antes de esta coordinación, #34 ya contenía:

- discovery SAFE/GET-only;
- parser de planillas;
- validación completa de identidad de planilla;
- resolución exacta de scope;
- bridge oficial por IDs para `clubId/teamId/tournamentId/athleteId/matchId/matchSheetId`;
- gates pre-Supabase;
- CI SAFE.

La rama estaba un commit detrás de `main`; los cambios de esta coordinación se limitan a `n8n/`, workflow SAFE y documentación, sin tocar los archivos web modificados en `main`.

## 3. Hallazgos especializados ya localizados

### Partidos

La rama especializada `research/femebal-matches-1.1.3` conserva el contrato estático 1.1.3:

- `match.id` = `matchId`;
- filtros/contextos por torneo/equipo;
- estado, fecha, equipos, resultado y metadata de partido;
- artefactos `data/femebal/discovery/matches/client_contract_1.1.3.json` y `docs/femebal/matches/discovery-1.1.3.md`.

No se mergea esa rama ni se duplica su investigación desde #34.

### Resultados / planillas

El repo ya tiene una planilla control parseable y un pipeline probado de:

`PDF → texto → parser → marcador → participantes → goles/sanciones → gate`

El importador histórico de programación **no es un importador de resultados**: `sync_partidos_7metros_bulk` crea/refresca/reprograma partidos, pero inserta `estado='programado'` y marcadores nulos. No existe todavía un writer productivo aprobado para resultados/participaciones.

### Clubes / escudos

La web ya tiene el soporte de `logo_url` y fallback. Lo que falta es **calidad/cobertura de datos**:

- 19/107 sin URL;
- URLs presentes que pueden no ser assets renderizables;
- falta preservar de manera reproducible la procedencia y validación del asset antes de reemplazar datos.

No se intenta descubrir escudos desde este integrador. Se consume la salida del frente Clubes.

## 4. Relaciones canónicas FEMEBAL → 7Metros

Toda integración debe usar un mapping explícito:

| FEMEBAL / LarrySport | 7Metros |
|---|---|
| `tournamentId` | `temporada_id` / contexto de competencia |
| `matchId` | `partidos.id` |
| `teamId` local | `equipos.id` local |
| `teamId` visitante | `equipos.id` visitante |
| `clubId` | `clubes.id` |
| `athleteId` | `jugadores.id` |
| `matchSheetId` | referencia de planilla, cuando exista mapping confirmado |

Regla: la igualdad numérica accidental entre IDs de ambos namespaces no crea una relación.

## 5. Mejora añadida: sync preview coordinado

Se agrega:

- `n8n/femebal-sync-preview-core.mjs`;
- `n8n/femebal-sync-preview-core-smoke.mjs`.

El core **no hace red y no escribe**.

### Resultados

Input esperado desde Partidos/Resultados:

- mapping `tournamentId → temporadaId`;
- `matchId → partidoId`;
- `homeTeamId → localEquipoId`;
- `awayTeamId → visitanteEquipoId`;
- estado final oficial;
- marcador oficial;
- fuente y timestamp;
- opcionalmente `matchSheetId`, URL/fuente de planilla y resumen de goles por participantes.

Comportamiento:

- sin `matchId`: `blocked_missing_official_match_id`;
- resultado nuevo coherente: `would_update_result`;
- resultado ya idéntico: `noop_already_matches`;
- resultado distinto de un marcador existente: `review_required_result_conflict`;
- suma de goles de participantes distinta del marcador: error fail-closed.

El preview nunca cambia la base y genera una clave idempotente estable a partir de IDs oficiales + marcador.

### Escudos

Input esperado desde Clubes:

- mapping `femebalClubId → clubes.id`;
- URL oficial candidata;
- URL de fuente;
- HTTP 200;
- Content-Type `image/*`;
- tamaño > 0;
- SHA-256;
- comprobación explícita `browserRenderable=true`.

Comportamiento:

- sin escudo actual: `would_fill_missing_logo`;
- misma URL ya verificada: `noop_already_matches`;
- URL oficial nueva distinta de la existente: `would_replace_logo`;
- asset no renderizable: `blocked_logo_not_renderable`;
- URL candidata HTTP: rechazada; el preview exige HTTPS para evitar incorporar nuevos riesgos de mixed content.

El integrador no afirma que HTTP sea la causa de los escudos actualmente rotos; sólo evita introducir candidatos inseguros de ese tipo.

## 6. Qué puede hacerse hoy sin intervención manual

Automáticamente y sin escribir se puede:

1. recibir manifests/resultados de los tres frentes;
2. cruzar IDs FEMEBAL con IDs internos;
3. detectar `matchId` faltantes;
4. validar score completo;
5. comparar score oficial vs score existente;
6. verificar que goles de participantes cierren con el resultado;
7. clasificar planilla y procedencia;
8. validar cobertura de escudos;
9. rechazar escudos no renderizables;
10. producir un batch DRY RUN deduplicado por clave idempotente;
11. separar `noop`, `would_update`, `blocked` y `review_required`.

No se necesita intervención de Tomás para ejecutar estas validaciones.

## 7. Bloqueos reales

### Resultados

Para los 2.689 partidos actuales no se debe pasar directamente de fecha/equipos a marcador. El gate automático necesita un `matchId` oficial y su mapping a `partidos.id`, o una evidencia equivalente previamente aceptada por el frente Partidos.

El writer actual de fixtures no actualiza resultados; un writer de resultados/participaciones requerirá diseño y aprobación separada antes de tocar Supabase.

### Participantes / estadísticas

El parser de planilla ya extrae jugadores y stats, pero la participación canónica exige `(matchId, athleteId)`. No se debe promover una fila de planilla identificada sólo por nombre a una participación oficial.

### Escudos

Los 19 faltantes pueden prepararse en preview apenas Clubes entregue candidates verificados por `clubId`.

Las URLs existentes que no renderizan deben traer diagnóstico del frente Clubes. El integrador no reemplaza una URL sólo porque “parece” mejor.

El esquema actual de `clubes` expone `logo_url`, pero no hay en el modelo público actual campos dedicados a SHA/fuente/fecha de validación. La procedencia se conserva en el manifest DRY RUN; persistirla en base implicaría una migración y aprobación humana.

## 8. Acciones que requieren aprobación humana

Antes de cualquier cambio productivo se necesita aprobación explícita para:

1. ejecutar escrituras reales de resultados/participaciones;
2. ejecutar escrituras reales de `logo_url`;
3. reemplazar un marcador existente por otro distinto;
4. reemplazar un escudo existente por otra URL;
5. agregar/migrar columnas para persistir IDs externos o provenance;
6. fusionar PR #75;
7. fusionar PR #34;
8. cualquier importación masiva.

No requieren aprobación:

- tests;
- validación offline;
- generación de manifests;
- previews DRY RUN;
- detección de conflictos;
- documentación.

## 9. Contrato de handoff entre chats

### 🏟️ Partidos debe entregar

```json
{
  "matchId": "...",
  "tournamentId": "...",
  "homeTeamId": "...",
  "awayTeamId": "...",
  "internalPartidoId": "...",
  "internalTemporadaId": "...",
  "internalLocalEquipoId": "...",
  "internalVisitanteEquipoId": "...",
  "source": {"url":"...", "observedAt":"..."}
}
```

### 📊 Resultados debe entregar

```json
{
  "matchId": "...",
  "status": "finalizado",
  "homeScore": 0,
  "awayScore": 0,
  "matchSheetId": "...",
  "planillaUrl": "...",
  "participantSummary": {"homeGoals":0, "awayGoals":0},
  "source": {"type":"...", "url":"...", "observedAt":"..."}
}
```

### 🛡️ Clubes debe entregar

```json
{
  "clubId": "...",
  "internalClubId": "...",
  "logoUrl": "https://...",
  "source": {"type":"...", "url":"...", "observedAt":"..."},
  "assetValidation": {
    "httpStatus": 200,
    "contentType": "image/png",
    "bytes": 1,
    "sha256": "...",
    "browserRenderable": true,
    "checkedAt": "..."
  }
}
```

# 10. Próximo paso

Esperar/consumir los primeros manifests de los frentes especializados y ejecutar el nuevo preview sobre un lote pequeño y verificable.

Orden recomendado:

1. 1 partido con `matchId` y marcador oficial;
2. su planilla y participantes;
3. 1 club sin escudo con asset oficial verificable;
4. 1 club con URL rota y replacement verificable;
5. recién después ampliar el DRY RUN.

No escribir en Supabase hasta que esos casos pequeños cierren y exista aprobación explícita.
