# FEMEBAL Community / LarrySport 1.1.3 — Partidos y fixture

## Alcance

Este documento cubre únicamente el contrato de **partidos/fixture** de FEMEBAL Community / LarrySport 1.1.3. No reconstruye estadísticas jugador por jugador y no realiza escrituras en Supabase ni en producción.

La evidencia estática se obtuvo del bundle Hermes v96 de la versión 1.1.3. En este entorno no fue posible completar una llamada runtime al host de API por una restricción de red/DNS, por lo que los IDs reales de Apertura 2026 se mantienen vacíos hasta observar una respuesta legítima del flujo guest de la app.

## 1. Contrato `/matches` confirmado en el cliente 1.1.3

### Listado

El cliente implementa un listado genérico:

```text
GET /matches?<query>
```

La página normalizada conserva:

- `items`
- `count`
- `next`
- `prev`

La paginación es por **`limit` + `skip`**.

Filtros confirmados por uso del cliente:

- `tournamentId`
- `teamId`
- `status`
- `date`
- `sortBy`

Los arrays se serializan separados por coma. Los operadores de filtro se serializan como `operador:valor`, por ejemplo:

```text
date=$gte:2026-03-21T00:00:00.000Z
date=$lte:2026-06-30T23:59:59.999Z
```

`URLSearchParams` aplica el percent-encoding final.

### Partido por ID

```text
GET /matches/{matchId}
```

Subrecursos observados en el cliente:

```text
GET /matches/{matchId}/live-update
GET /matches/{matchId}/formation
GET /matches/{matchId}/preview
GET /matches/{matchId}/mvp/results
GET /matches/{matchId}/stats
GET /matches/{matchId}/referees
GET /matches/{matchId}/coachingStaff
GET /matches/{matchId}/events?...
GET /matches/tournaments/{tournamentId}/teams/{teamId}/played-count
GET /athletes/topScorers/{matchId}
```

Las rutas UI `/matches/[id]`, `/matches/[id]/summary` y `/matches/preview/[matchId]` existen en la app, pero una ruta de UI no debe confundirse con un endpoint API si no aparece como tal en el cliente HTTP.

## 2. `tournamentId → matches` confirmado

El método del cliente `getMatchesByTournamentId` llama al listado genérico con:

```json
{
  "tournamentId": "<tournamentId>",
  "limit": 0
}
```

Semánticamente:

```text
GET /matches?tournamentId=<tournamentId>&limit=0
```

La vista `TournamentFixtureView` inicializa el fixture con `tournamentId` y, para el fixture ordinario, usa agrupación por `matchday` y orden `matchday:asc`. Para formatos tipo grilla cambia a `instance` / `round:asc`.

**Conclusión:** `tournamentId` es suficiente para pedir el fixture de ese torneo a través de `/matches`.

## 3. `teamId → matches` confirmado

Las vistas de equipo construyen filtros con:

```json
{
  "tournamentId": "<tournamentId>",
  "teamId": "<teamId>",
  "limit": "<n>"
}
```

Próximos partidos:

```text
date=$gte:<ISO>
sortBy=date:asc
```

Partidos pasados:

```text
date=$lte:<ISO>
sortBy=date:desc
status=finalized
```

**Conclusión:** el camino reproducible es `teamId + tournamentId → /matches`, sin necesidad de adivinar `matchId`.

## 4. Modelo de partido confirmado

El JSON serializado por el modelo `ScheduledMatch` contiene:

- `id` → usar como `matchId`
- `homeTeam`
- `awayTeam`
- `date`
- `tournamentId`
- `matchday`
- `status`
- `urlTransmission`
- `matchSheetStatus`
- `playingField`
- `isFictitiousMatch`
- `eliminationTournamentMatch`
- `isTelevised`
- `hasMvpVoting`

Un partido finalizado agrega:

- `result`
- `finishedAt`

`result` contiene:

- `homeTeamGoals`
- `awayTeamGoals`
- `definitionByPenalties`
- `homePenaltyGoals`
- `awayPenaltyGoals`

Por lo tanto el marcador puede venir directamente en el recurso de partido finalizado; no hace falta reconstruirlo sumando jugadores.

`playingField` es un objeto estructurado nullable; el modelo de la app admite metadata de sede/cancha como nombre/dirección/ciudad cuando el backend la entrega.

## 5. Categoría, división y rama

El torneo serializado contiene:

- `id`
- `name`
- `type`
- `federationId`
- `ageCategory`
- `season`
- `gender`
- `startDate`
- `status`
- `division`
- `isRelevant`

La app construye el nivel de competencia como:

```text
ageCategory.name + " - " + division.name + " - " + gender.name
```

Así, el join correcto es:

```text
match.tournamentId
→ tournament.id
→ ageCategory + division + gender + season
```

No hace falta exigir que categoría/división/rama estén duplicadas en el top-level del partido.

El cliente también conoce:

```text
GET /competition-level/categories
GET /competition-level/divisions?...
```

`multidivisionId` aparece en el modelo de multi-división/competition level, pero **no quedó confirmado como campo directo del Match JSON** en el análisis estático 1.1.3. Debe tratarse como relación de competencia hasta observar un payload runtime.

## 6. `matchId` vs `matchSheetId`: corrección clave

### `matchId`

Es el ID canónico del partido. Se usa para:

- `GET /matches/{matchId}`
- stats
- eventos
- árbitros
- cuerpo técnico
- formación
- preview
- top scorers y otros subrecursos ligados al partido

Para el futuro chat de Resultados, este es el ID que debe conservarse como FK principal desde `partidos`.

### `matchSheetId`

En 1.1.3, `matchSheetId` se observa estáticamente dentro de:

- `RefereeByMatch`
- `CoachingStaffByMatch`

Ejemplo conceptual:

```text
RefereeByMatch:
  id
  fullName
  matchId
  matchSheetId
  refNumber

CoachingStaffByMatch:
  id
  fullName
  matchId
  matchSheetId
  teamId
  order
```

No aparece en el modelo top-level `ScheduledMatch` / `FinalizedMatch` analizado.

**No está demostrado** que `matchSheetId` sea el ID del PDF, que permita descargar la planilla completa ni que sea equivalente al hash del archivo CloudFront.

El partido control posee una planilla oficial conocida:

```text
https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf
```

Su token `5ce377051ea0acb1` debe mantenerse como **referencia documental separada** hasta que runtime pruebe una relación con `matchSheetId`.

## 7. Partido control

Evidencia existente y reproducible:

```text
Torneo: Torneo Metropolitano Apertura
Fecha: 2026-03-21
Hora: 20:15:00
Categoría: Mayores
División: LHC Hipotecario Seguros
Local: Argentinos Juniors 20
Visitante: Ferro Carril Oeste 27
```

La planilla oficial está documentada en el repo y el parser de regresión valida fecha, hora, categoría, división, equipos y marcador.

Los campos `matchId`, `tournamentId`, `homeTeamId`, `awayTeamId`, `matchSheetId` y `multidivisionId` se dejan intencionalmente sin completar: no se adivinan.

## 8. Preview Apertura 2026

Se generó `data/femebal/discovery/matches/preview_apertura_2026.csv` con partidos reales publicados de Ferro, incluido el control Argentinos Juniors 20–27 Ferro y varias fechas posteriores. Cada columna de ID API queda vacía mientras no haya evidencia guest runtime.

Esto permite separar dos capas:

1. **partido real confirmado públicamente**;
2. **identidad API 1.1.3 pendiente de captura legítima**.

## 9. Modelo de unión recomendado para 7Metros

```text
Tournament
  id = tournamentId
  ageCategory / division / gender / season
        |
        v
Match
  id = matchId
  tournamentId
  matchday
  date
  status
  homeTeam.id
  awayTeam.id
  result
  playingField
  matchSheetStatus
        |
        +--> /matches/{matchId}/...
        |
        +--> RefereeByMatch / CoachingStaffByMatch
               matchId
               matchSheetId   [NO asumir que es PDF]

Official sheet document
  planilla_url / CloudFront hash
  [relación con matchSheetId pendiente de prueba]
```

## 10. Pendiente de runtime

Para convertir el preview en filas totalmente unibles faltan únicamente los IDs reales devueltos por la sesión guest legítima:

- `tournamentId` de Apertura 2026 LHC Caballeros;
- `teamId` de Ferro y rivales;
- `matchId` de cada partido;
- `matchSheetId` si aparece en `/referees` o `/coachingStaff`;
- `multidivisionId` si alguna respuesta runtime lo relaciona con el fixture;
- relación efectiva entre el recurso API y la URL de planilla oficial.

No hace falta enumerar IDs ni probar valores al azar: basta observar una carga normal del fixture/detalle en la app.

### INTERVENCIÓN DE TOMÁS

Capturar **una sola navegación guest normal** al fixture de Apertura 2026 LHC Caballeros y al detalle de Argentinos Juniors–Ferro. Compartir únicamente:

1. URL completa de la request `/matches?...`;
2. JSON de respuesta de esa request;
3. si el listado no trae todos los campos, URL + JSON de `GET /matches/{matchId}` del partido control;
4. opcionalmente URL + JSON de `/matches/{matchId}/referees` o `/coachingStaff` para validar `matchSheetId`.

Antes de compartir, **redactar `Authorization`, cookies y cualquier token**. No se necesita ninguna credencial para documentar el contrato.
