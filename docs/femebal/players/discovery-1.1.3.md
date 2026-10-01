# FEMEBAL Community 1.1.3 — descubrimiento de JUGADORES

Fecha de análisis: 2026-10-01  
Alcance: **athletes/jugadores únicamente**.  
Package: `com.tecdata.larrysportmobile.cah`  
API base: `https://api.femebal.cam.larrysport.tecdata.net`  
Cliente: `1.1.3`  
Bundle analizado: Hermes bytecode v96  
SHA-256 del bundle: `1c4d137233e2524f8491a332caad17e6058fc44d0228568fb746f0377f869681`

## 1. Estado

### Confirmado en código 1.1.3

El cliente confirma el flujo:

`nombre → /search → athleteId → /athletes/{id} → /users/athlete-profile/{id} → /athletes/{id}/tournaments → teamId/clubId/tournamentId`

También confirma un bootstrap guest legítimo:

`POST /init-onboarding` (sin Authorization) → `accessToken` / `refreshToken` → `Authorization: Bearer <accessToken>` para las lecturas normales.

### Runtime en esta sesión

Se intentó llegar a `POST /init-onboarding` desde el entorno de ejecución de ChatGPT. La resolución DNS falló **antes de cualquier respuesta HTTP** (`Could not resolve host`). Por lo tanto no existe todavía una muestra runtime verificable desde este entorno; no se reinterpretó el fallo como 401/403, no se ejecutaron GETs anónimos alternativos y no se inventaron IDs.

El archivo `data/femebal/discovery/players/guest_probe.py` permite obtener una muestra de **un solo jugador** desde una red normal respetando el guest flow de 1.1.3.

## 2. Endpoints exactos de athletes

| Propósito | Método | Ruta exacta / template | Estado |
|---|---|---|---|
| Buscar jugador por nombre | GET | `/search?query=<texto>&type=athletes&skip=0` | Confirmado en código |
| Perfil base Athlete | GET | `/athletes/{athleteId}` | Confirmado en código |
| Contextos equipo/torneo | GET | `/athletes/{athleteId}/tournaments` | Confirmado en código |
| Stats del atleta en torneo | GET | `/athletes/{athleteId}/tournaments/{tournamentId}/stats` | Confirmado; fuera del preview básico |
| Atletas de un equipo | GET | `/athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}` | Confirmado; no usar para importación masiva ahora |
| Sociales | GET | `/athletes/{athleteId}/socials` | Confirmado en código |
| Equipo predeterminado | GET | `/athletes/{athleteId}/default-team` | Confirmado en código |
| Club ID asociado | GET | `/athletes/{athleteId}/club-id` | Confirmado en código |
| Posición y dorsal | GET | `/athletes/formation/positionAndNumber?athleteIds=<ids>` | Confirmado en código |
| MVP awards | GET | `/athletes/{athleteId}/mvp-awards` | Confirmado en código |
| Perfil comunitario | GET | `/users/athlete-profile/{athleteId}` | Confirmado en código |
| Ficha federativa | GET | `/athletes/{athleteId}/federative-card` | Confirmado; no incluido en probe por `documentNumber` |
| Buscar por documento | GET | `/athletes/document/{documentNumber}` | Confirmado; no usar para discovery |
| Top scorers por partido | GET | `/athletes/topScorers/{matchId}` | Confirmado; fuera de alcance |

Las escrituras de verificación/reportes (`begin-verification`, `complete-verification`, `athlete-not-found-report`) quedan fuera de este trabajo.

## 3. Búsqueda, filtros y paginación

El `SearchView` 1.1.3 construye parámetros con `query`, `type` (`athletes`/`clubs`), `gender` (`F`/`M`) y `skip`. La respuesta consumida por la UI expone `athletes`, `clubs`, `limit` y `skip`.

**Conclusión:** la paginación observada es `skip`-based. El servidor devuelve `limit`, pero no se confirmó que el cliente envíe un `limit` configurable desde esa vista.

## 4. Esquema de jugador

### `Athlete`: identidad base

`Athlete.fromJson` consume exactamente:

```text
id
firstName
lastName
birthDate
picture
avatarUrl
```

`id` es el candidato directo a **athleteId / ID LarrySport-FEMEBAL**. La app calcula edad desde `birthDate`, por lo que edad no es un campo independiente de este modelo.

### `AthleteProfile`: perfil comunitario/deportivo

Campos observados:

```text
athlete
status
shirtNumber
worldMessage
height
position
useFederationPicture
socialMedia
```

Más campos heredados/copiados del perfil:

```text
userId
alias
avatarUrl
avatarType
```

`status` se usa en UI de verificación (`verified`); no debe interpretarse como estado deportivo activo/inactivo.

### `AthleteFederativeCard`

Campos observados:

```text
athleteId
picture
fullName
documentNumber
birthDate
habilitationYear
category
clubName
status
```

Como contiene `documentNumber`, se documenta estáticamente pero se excluye del probe mínimo.

## 5. IDs y relaciones

La relación más útil es `/athletes/{athleteId}/tournaments`. Cada elemento se transforma como `{ team: Team, tournament: Tournament }`.

### `Team`

Campos: `id`, `name`, `club`, `ageCategory`, `division`, `gender`.

- `team.id` → **teamId**
- `team.club.id` → **clubId**
- `team.club.name` → club
- `team.ageCategory` → categoría
- `team.division` → división
- `team.gender` → rama/género

### `Club`

Campos: `id`, `name`, `picture`.

### `Tournament`

Campos: `id`, `name`, `type`, `federationId`, `ageCategory`, `season`, `gender`, `startDate`, `status`, `division`, `isRelevant`.

- `tournament.id` → **tournamentId**
- `tournament.season` → temporada

### `Season`

Campos: `id`, `description`, `startDate`, `endDate`, `previousSeasonId`.

## 6. Permanente vs dependiente del contexto

**Identidad base:** athleteId, nombre, apellido, fecha de nacimiento y picture/avatar base.

**Perfil comunitario:** alias, altura, posición, dorsal, worldMessage, social media, avatar y estado de verificación.

**Contexto equipo/torneo:** teamId, clubId, club, categoría, división, rama/género, tournamentId, temporada y estado del torneo.

### Dorsal y posición: límite semántico pendiente

La app usa `/athletes/formation/positionAndNumber?athleteIds=...` dentro de una formación de equipo/torneo y consume `position` y `shirtNumber` (con fallback observado a `number`). Sin embargo, la URL recibe solo athleteIds, no teamId/tournamentId. El código estático no permite asegurar si dorsal/posición son globales/current, derivados del contexto actual o una proyección backend del último plantel. Debe resolverse con runtime antes de modelarlo como histórico por temporada.

## 7. Flujo reproducible recomendado

1. `POST /init-onboarding`.
2. Mantener `accessToken` solo en memoria como Bearer.
3. `GET /search?query=<nombre>&type=athletes&skip=0`.
4. Seleccionar un resultado sin adivinar y conservar `athlete.id`.
5. `GET /athletes/{id}`.
6. `GET /users/athlete-profile/{id}`.
7. `GET /athletes/{id}/tournaments`.
8. Leer `team.id`, `team.club.id`, `tournament.id`.
9. Para ese mismo único id, opcionalmente consultar `default-team`, `club-id` y `positionAndNumber`.

No es necesario consultar partidos ni resultados para demostrar esta relación.

## 8. Muestra real

**Pendiente de runtime.** No se incluye ningún athleteId ficticio.

`data/femebal/discovery/players/players-preview.pending.json` conserva un preview vacío hasta que exista respuesta real. El probe propuesto busca puntualmente `Agustin Unzner`; no fija ni presupone su ID y se detiene si la búsqueda es ambigua.

## 9. Guardrails aplicados

- sin credenciales privadas;
- sin bypass de autenticación;
- sin `/athletes/document/...` runtime;
- sin `federative-card` runtime;
- sin enumeración masiva de planteles;
- sin partidos/resultados;
- sin Supabase;
- sin producción;
- sin IDs inventados.
