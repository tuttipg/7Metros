# FEMEBAL / LarrySport 1.1.3 — PLANTELES Y PERFILES

Handoff actual para Integración. Evidencia cerrada al 2026-10-02.

## Contrato confirmado de plantel

```text
RosterMembership = (teamId, tournamentId, athleteId)
```

Superficies principales:

```text
FORWARD
teamId + tournamentId
  -> GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
  -> athleteId[]

REVERSE
athleteId
  -> GET /athletes/{athleteId}/tournaments
  -> (team,tournament)[]
```

El forward enumera el roster exacto. El reverse sirve para descubrir/validar pertenencias expuestas. No modelar `athleteId -> clubId` ni `athleteId -> teamId` como 1:1 permanente.

## Resolver `club + temporada + categoría + división + rama -> jugadores`

```text
clubId
 -> teamId
 -> tournamentId
 -> roster exacto
 -> athleteId[]
```

1. Resolver `teamId` desde `/teams` usando IDs/metadata exacta.
2. Resolver la competencia/tournamentId para el scope solicitado.
3. Consultar `GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}`.
4. Exigir athleteIds no nulos y únicos dentro del roster exacto.
5. Si A/B/C/D vuelven ambiguo el scope humano, fallar cerrado y conservar el discriminador de equipo.
6. No usar joins principales por nombre.

## Controles E2E

```text
Ferro Carril Oeste
clubId        335
teamId        1843  Mayores A
categoryId    100
divisionId    421  LHC Hipotecario Seguros
rama          Masculino
tournamentId  775  Apertura 2026
roster        16 / 16 athleteId únicos
```

```text
S.A.G. Villa Ballester
clubId        334
teamId        3291  Mayores A / LHC
tournamentId  775  Apertura 2026
roster        25 / 25 athleteId únicos
```

## Validación reverse

Primero se verificaron 13/13 pares de atletas con múltiples pertenencias contra el roster forward correspondiente. Después se hizo cierre completo forward→reverse de dos rosters:

```text
Ferro 1843/775      16/16, 0 faltantes
Ballester 3291/775  25/25, 0 faltantes
TOTAL               41/41, 0 faltantes
```

El reverse es una fuente fuerte de pertenencias, pero no se presume historial global exhaustivo para toda asociación antigua.

## `teamId -> tournaments` no es historial exhaustivo

`GET /teams/1843/tournaments` expuso en el runtime principal `775` y `1204`, pero también se comprobaron como válidos otros pares del mismo teamId, entre ellos `776`, `218`, `219` y `526`.

Usar el listado del equipo para resolver competencias expuestas, pero no descartar una membresía validada únicamente porque el torneo no aparezca allí.

## Nunca usar roster sin `tournamentId`

Para Ferro `teamId=1843`, `GET /athletes/athletesByTeam/1843` dio 106 filas / 31 athleteId únicos.

Se demostró que es exactamente la concatenación multiconjunto de seis rosters reales:

```text
218  -> 20
219  -> 16
526  -> 19
775  -> 16
776  -> 16
1204 -> 19
TOTAL  106
```

Coinciden también las multiplicidades de cada athleteId. La respuesta perdió el contexto `tournamentId` de cada fila.

```text
teamId solo                   -> NO RosterMembership
dedupe(teamId solo)           -> NO RosterMembership
teamId + tournamentId exactos -> SÍ fuente de roster
```

## Un atleta puede estar en varios planteles

En Ferro masculino 2026 se observaron 20 equipos, 482 membresías y 192 athleteId únicos. Entre ellos, 80 athleteId aparecen en más de un teamId y 63 aparecen en más de una categoría.

La pertenencia debe ser entidad propia; no guardar un único teamId/clubId permanente dentro de Athlete.

## Perfil de jugador: cobertura real

Sobre los **16 jugadores completos de Ferro 1843/775** se midió cobertura sin registrar valores personales individuales:

| Superficie/campo | Cobertura |
| --- | ---: |
| identidad Athlete | 16/16 |
| fecha de nacimiento no nula en identidad | 16/16 |
| foto no nula en identidad | 16/16 |
| `/users/athlete-profile/{id}` accesible | 16/16 |
| altura de perfil no nula | 10/16 |
| posición de perfil no nula | 13/16 |
| número de camiseta de perfil no nulo | 10/16 |
| campo status de perfil presente | 16/16 |
| ficha federativa accesible | 16/16 |
| default-team accesible | 16/16 |
| club-id accesible | 16/16 |
| entrada en bulk `formation` | 16/16 |
| posición en `formation` no nula | 13/16 |
| shirtNumber en `formation` no nulo | 10/16 |

Esto muestra que la identidad está completa en el control, mientras los enriquecimientos de perfil son parciales y deben aceptar `null`.

## `formation` es enriquecimiento de perfil, no de plantel

Se comparó atleta por atleta:

```text
GET /users/athlete-profile/{athleteId}
vs
GET /athletes/formation/positionAndNumber?athleteIds={ids}
```

Resultado sobre los 16 jugadores:

```text
position:    16/16 iguales incluyendo null
              13 valores no-null iguales
               0 diferencias

shirtNumber: 16/16 iguales incluyendo null
              10 valores no-null iguales
               0 diferencias
```

Por lo tanto, en este control completo `formation.position` y `formation.shirtNumber` son un espejo exacto de esos campos de perfil. La interpretación segura es **bulk athlete-profile enrichment**, no metadata específica de `(teamId,tournamentId,athleteId)`.

No convertirlos en dorsal o posición histórica de `RosterMembership`.

## Estadísticas por torneo: entidad separada

Confirmado:

```text
GET /athletes/{athleteId}/tournaments/{tournamentId}/stats
```

Cada fila contiene `matchId`, `goals` y sanciones (`yellowCards`, `redCards`, `blueCards`, `twoMinuteSuspensions`). Es rendimiento/participación por partido, no metadata del plantel.

```text
AthleteTournamentMatchStat(
  athleteId,
  tournamentId,
  matchId,
  goals,
  sanctions...
)
```

## Superficies auxiliares

Confirmados como superficies de atleta/perfil:

```text
GET /athletes/{athleteId}
GET /athletes/{athleteId}/default-team
GET /athletes/{athleteId}/club-id
GET /users/athlete-profile/{athleteId}
GET /athletes/formation/positionAndNumber?athleteIds={ids}
GET /athletes/{athleteId}/federative-card
GET /athletes/{athleteId}/socials
GET /athletes/{athleteId}/mvp-awards
```

La ficha federativa contiene metadata de identidad/habilitación/categoría/club/estado, pero no `teamId` ni `tournamentId`; su estado no significa activo/baja de un plantel concreto. Las sondas de cobertura guardaron sólo estructura y conteos, no valores personales.

`default-team` es una asociación singular/default y `club-id` una asociación de perfil. Ninguno reemplaza el historial de `RosterMembership`.

## Frontera de metadata de membresía — cerrada para 1.1.3

Después del análisis estático del bundle Hermes v96 y runtime de las superficies usadas por el cliente distribuido, quedan como:

```text
not_exposed_in_confirmed_1_1_3_client_surfaces
```

- rol de membresía;
- activo/baja explícito por team+tournament;
- fecha de alta;
- fecha de baja/fin;
- ID propio de la relación;
- dorsal scopeado a team+tournament;
- posición scopeada a team+tournament.

Esto no afirma que sea imposible que exista un recurso interno/no usado por la app. Significa que Integración no debe inventarlo ni esperarlo del contrato confirmado 1.1.3.

## Modelo recomendado

```text
Athlete(
  athleteId,
  identidad...
)

AthleteProfile(
  athleteId,
  height?,
  position?,
  shirtNumber?,
  defaultTeamId?,
  associatedClubId?,
  federativeSportsMetadata?,
  provenance...
)

RosterMembership(
  teamId,
  tournamentId,
  athleteId,
  provenance...
)

AthleteTournamentMatchStat(
  athleteId,
  tournamentId,
  matchId,
  goals,
  sanctions...
)
```

Los campos opcionales de AthleteProfile deben aceptar `null`. No promover status, position, shirtNumber, default-team o club-id a propiedades históricas de RosterMembership.

## Evidencia canónica

- `data/femebal/discovery/rosters/roster-integration-contract-v1.json`
- `data/femebal/discovery/rosters/player-profile-integration-contract-v1.json`
- `data/femebal/discovery/rosters/player-profile-coverage-ferro-1843-775-2026-10-02.json`
- `data/femebal/discovery/rosters/ferro-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/sag-villa-ballester-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/full-bidirectional-closure-2026-10-01.json`
- `data/femebal/discovery/rosters/athlete-tournaments-reverse-membership-2026-10-01.json`
- `data/femebal/discovery/rosters/ferro-1843-unscoped-multiset-semantics-2026-10-01.json`
- `data/femebal/discovery/rosters/athlete-scoped-surfaces-boundary-2026-10-02.json`
- `data/femebal/discovery/rosters/apk-1.1.3-static-roster-surface.json`
- `docs/femebal/rosters/larrysport-1.1.3-roster-contract.md`
- `docs/femebal/rosters/membership-metadata-boundary.md`
- `docs/femebal/rosters/reverse-membership.md`
- `docs/femebal/rosters/unscoped-roster-semantics.md`

## Runtime permanente y seguridad

La única Action específica de PLANTELES que debe quedar visible al terminar es `.github/workflows/femebal-roster-runtime-safe.yml`.

Las sondas temporales se eliminan después de guardar sus resultados. Guest efímero, token enmascarado, GET-only después del onboarding; sin escrituras en Supabase ni producción.
