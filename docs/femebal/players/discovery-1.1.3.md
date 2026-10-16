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

El cliente confirma el flujo estático:

`nombre → /search → athleteId → /athletes/{id} → /users/athlete-profile/{id} → /athletes/{id}/tournaments → teamId/clubId/tournamentId`

También se observó en el bundle un bootstrap guest:

`POST /init-onboarding` (sin Authorization) → `accessToken` / `refreshToken` → `Authorization: Bearer <accessToken>` para las lecturas normales.

**Importante:** esta secuencia es evidencia de código analizado, no una instrucción operativa para el discovery SAFE de 7Metros. El repositorio autónomo no debe ejecutar ni solicitar ese bootstrap, obtener tokens, conservarlos o enviar `Authorization`.

### Runtime en esta sesión

La documentación histórica registraba un intento de llegar a `POST /init-onboarding` desde el entorno de ejecución de ChatGPT, con fallo DNS antes de cualquier respuesta HTTP. Ese resultado no constituye una muestra runtime verificable y no debe reinterpretarse como 401/403.

El archivo `data/femebal/discovery/players/guest_probe.py` fue convertido en un **placeholder SAFE sin red**: no realiza requests, no obtiene tokens y termina indicando que el runtime guest está deshabilitado. La evidencia utilizable para este frente queda limitada al contrato estático y a documentación/análisis de código.

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
| Ficha federativa | GET | `/athletes/{athleteId}/federative-card` | Confirmado; no usar para discovery autónomo |
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

Como contiene `documentNumber`, se documenta estáticamente pero se excluye del discovery runtime autónomo.

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

La app usa `/athletes/formation/positionAndNumber?athleteIds=...` dentro de una formación de equipo/torneo y consume `position` y `shirtNumber` (con fallback observado a `number`). Sin embargo, la URL recibe solo athleteIds, no teamId/tournamentId. El código estático no permite asegurar si dorsal/posición son globales/current, derivados del contexto actual o una proyección backend del último plantel. Debe resolverse con evidencia runtime legítima antes de modelarlo como histórico por temporada.

## 7. Flujo SAFE recomendado

Para el discovery autónomo de 7Metros **no se ejecuta el guest bootstrap ni se solicitan tokens**.

1. Usar únicamente evidencia pública ya observada o documentación/análisis estático legítimo.
2. Mantener los templates de endpoints como contrato estático, sin inventar IDs ni respuestas.
3. Si aparece una fuente pública anónima independiente, validarla por separado antes de considerar un GET.
4. No usar `/athletes/document/...` ni rutas de escritura/verificación.
5. No usar el flujo `POST /init-onboarding → token → Authorization` dentro del runtime SAFE.
6. No escribir en Supabase ni en producción.

No es necesario consultar partidos ni resultados para demostrar la relación estática de jugadores.

## 8. Muestra real

**Pendiente de runtime legítimo.** No se incluye ningún athleteId ficticio.

`data/femebal/discovery/players/players-preview.pending.json` conserva un preview vacío hasta que exista una respuesta real y autorizada por el alcance SAFE. No se fija ni presupone ningún ID.

## 9. Guardrails aplicados

- sin credenciales privadas;
- sin obtención ni uso de tokens;
- sin cookies ni headers `Authorization`;
- sin bypass de autenticación;
- sin `/athletes/document/...` runtime;
- sin `federative-card` runtime;
- sin enumeración masiva de planteles;
- sin partidos/resultados;
- sin Supabase;
- sin producción;
- sin IDs inventados.
