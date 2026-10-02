# FEMEBAL / LarrySport 1.1.3 — PLANTELES

Handoff para Integración. Evidencia al 2026-10-01.

## Contrato confirmado

La pertenencia deportiva se modela como:

```text
(teamId, tournamentId, athleteId)
```

Hay dos superficies complementarias confirmadas:

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

El forward es la fuente para enumerar un plantel exacto. El reverse es un índice real de membresías por atleta y sirve para descubrir/validar los pares `teamId+tournamentId` asociados a ese atleta.

No modelar `athleteId -> clubId` ni `athleteId -> teamId` como relaciones permanentes 1:1.

## Ejemplo E2E principal

```text
Ferro Carril Oeste
clubId        335
teamId        1843  (Mayores A)
categoryId    100   (Mayores)
divisionId    421   (LHC Hipotecario Seguros)
rama          Masculino
tournamentId  775   (Torneo Metropolitano Apertura 2026)
roster        16 atletas / 16 athleteId únicos
```

Confirmado código + runtime + validación visual manual.

Segundo control:

```text
S.A.G. Villa Ballester
clubId        334
teamId        3291  (Mayores A / LHC)
tournamentId  775   (Apertura 2026)
roster        25 atletas / 25 athleteId únicos
```

## Índice inverso de membresías

`GET /athletes/{athleteId}/tournaments` está confirmado en código 1.1.3 y runtime. Cada fila observada contiene sólo:

```text
team
tournament
```

Se validaron cuatro atletas de dos clubes. Cada par reverse fue consultado luego contra el roster forward exacto.

```text
13 pares reverse
13 pares donde el roster forward contiene al mismo athleteId
13/13 OK
```

Ejemplos:

- Bartolomeo `16284`: `369/790`, `1843/775`, `369/1213`, `1843/1204`.
- Tonko `10565`: `3715/834`, `3715/1223`, `3256/1205`, `369/1213`.
- Schankula `19480`: `1843/776`, `1843/775`, `1843/1204`.
- Simonet `21150`, SAG Villa Ballester: `3291/775`, `3291/1204`.

Esto permite validar membresías sin joins por nombre.

## `/teams/{teamId}/tournaments` no es un historial exhaustivo

Se encontró una asimetría importante.

En el mismo runtime, para `teamId=1843`:

```text
GET /teams/1843/tournaments
```

devolvió únicamente `775` y `1204`.

Pero el reverse de Schankula devolvió también `1843/776`, y el roster forward exacto:

```text
GET /athletes/athletesByTeam/1843?tournamentId=776
```

devolvió 16 atletas e incluyó a `19480`.

Por eso:

- `/teams/{teamId}/tournaments` sigue siendo útil para resolver competencias expuestas al pedir un scope concreto;
- no debe tratarse como historial completo de todas las membresías válidas;
- una membresía reverse no debe descartarse sólo porque ese tournamentId no aparezca en el listado del equipo;
- para integridad fuerte, un par reverse puede confirmarse con el roster forward exacto.

## `tournamentId` es obligatorio para un plantel exacto

El servidor acepta omitirlo, pero esa respuesta **NO representa el plantel exacto**.

| Equipo | Con torneo | Sin torneo |
| --- | ---: | ---: |
| Ferro Mayores A `1843`, Apertura LHC `775` | 16 filas / 16 IDs | 106 filas / 31 IDs |
| Ferro Mayores B `3256`, Apertura Plata `782` | 26 / 26 | 103 / 46 |
| Ballester Mayores A `3291`, Apertura LHC `775` | 25 / 25 | 131 / 30 |

Para `teamId=1843`, las 106 filas sin torneo son sólo 31 objetos de identidad únicos. Las repeticiones son objetos idénticos y no contienen contexto oculto de membresía.

Apertura `775` + Clausura `1204` forman una unión de 21 IDs únicos; la respuesta sin torneo agrega otros 10 IDs. Por eso no es el plantel actual, no es sólo la unión 2026 y deduplicarla tampoco recupera el plantel correcto.

Pares reales pero incompatibles, por ejemplo `1843+790` o `3256+775`, responden `HTTP 200 []`. HTTP 200 solo no valida el par.

## Resolución fail-closed

Para el pedido directo:

```text
club + temporada + categoría + división + rama
-> equipo
-> torneo
-> plantel
```

usar:

1. `GET /teams` para resolver `teamId` con IDs/metadata exactos;
2. `/teams/{teamId}/tournaments` para localizar la competencia solicitada cuando esté expuesta allí;
3. `GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}` para enumerar el plantel;
4. exigir `tournamentId` y athleteIds no nulos/únicos dentro del roster exacto;
5. no aceptar la variante sin tournamentId.

Para descubrir o validar pertenencias de un atleta ya conocido:

1. `GET /athletes/{athleteId}/tournaments`;
2. conservar cada `teamId+tournamentId` original;
3. opcionalmente confirmar cada par contra el roster forward;
4. no exigir que todos esos pares aparezcan en `/teams/{teamId}/tournaments`.

## Evidencia estática APK 1.1.3

El bundle `base.apk/assets/index.android.bundle` es Hermes bytecode v96. El análisis confirma:

- `getAthletesByTeam`;
- `/athletes/athletesByTeam/`;
- construcción opcional de `?tournamentId=`;
- `GET /athletes/{athleteId}/tournaments`, mapeado como `{team,tournament}`;
- `getPositionAndNumberByAthleteIds`;
- `/athletes/formation/positionAndNumber?athleteIds=`.

El flujo de UI de Team Formation conserva `teamId+tournamentId` para cargar atletas y luego pide posición/número como enriquecimiento separado por athleteId.

No se observó otra ruta evidente de gestión de membresía bajo términos `roster`, `squad`, `membership` o `assignment`. Esto no demuestra que el servidor carezca de superficies internas no usadas por la app.

## Un atleta puede integrar varios planteles

Ferro masculino 2026:

- 20 equipos;
- 482 membresías `(teamId,tournamentId,athleteId)`;
- 192 athleteId únicos;
- 170 IDs en más de una membresía;
- 80 IDs en más de un teamId;
- 63 IDs en más de una categoría;
- 17 IDs en varios teamId dentro de una sola categoría;
- 0 observados en dos teamId dentro del mismo tournamentId;
- 90 repetidos solamente entre torneos del mismo teamId.

El `0` del mismo tournamentId sólo está probado para ese scope; no convertirlo en regla global.

## default-team, club-id y perfil no son el plantel

Confirmados:

```text
GET /athletes/{athleteId}/default-team
GET /athletes/{athleteId}/club-id
GET /users/athlete-profile/{athleteId}
```

Bartolomeo `16284` tiene `default-team=369 Junior A`, aunque también integra `1843/775` y `1843/1204`. Tonko `10565` tiene `default-team=3715`, aunque el reverse confirma múltiples planteles. Por lo tanto, default-team es perfil/default, no historial de membresías.

`status="pending"` observado en user-athlete-profile tampoco está scopeado por team+tournament y no significa activo/baja del roster.

## Dorsal y posición

`formation.shirtNumber` no es dorsal histórico confiable del plantel.

Comparación Ferro vs planilla oficial 2026-03-21:

- 16 jugadores con dorsal en planilla;
- formation tiene shirtNumber no-null para 10;
- 7 coinciden;
- 3 difieren;
- 6 tienen formation null aunque la planilla tiene dorsal.

El dorsal de planilla pertenece a esa participación de partido. No promoverlo automáticamente a `RosterMembership`.

Siguen pendientes/no expuestos en las superficies confirmadas:

- rol de membresía;
- activo/baja explícito;
- fecha alta/baja;
- ID propio de la relación;
- dorsal scopeado a team+tournament;
- posición scopeada a team+tournament.

## Calidad de metadata

Se observó un caso que obliga a conservar la metadata original:

```text
tournamentId = 776
name = Super 8 Liga Hipotecario Seguros Masculino 2025
season.description = 2026
```

No derivar la temporada únicamente desde el nombre visible del torneo.

## Contrato para Integración

Archivo principal machine-readable:

`data/femebal/discovery/rosters/roster-integration-contract-v1.json`

Modelo recomendado:

```text
Athlete(athleteId, identidad...)
AthleteProfile(athleteId, defaultTeamId?, associatedClubId?, profile fields...)
RosterMembership(teamId, tournamentId, athleteId, provenance...)
```

Guardar hechos e IDs originales. No inferir membresía desde nombres, default-team, club-id, perfil, ausencia en otro torneo, fechas del torneo ni shirtNumber de perfil/formación.

## Evidencia principal

- `data/femebal/discovery/rosters/ferro-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/sag-villa-ballester-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/athlete-tournaments-reverse-membership-2026-10-01.json`
- `data/femebal/discovery/rosters/ferro-2026-membership-diagnostic.json`
- `data/femebal/discovery/rosters/default-team-vs-membership-2026-10-01.json`
- `data/femebal/discovery/rosters/membership-metadata-boundary-2026-10-01.json`
- `data/femebal/discovery/rosters/ferro-formation-vs-match-dorsal-2026-03-21.json`
- `data/femebal/discovery/rosters/apk-1.1.3-static-roster-surface.json`
- `data/femebal/discovery/rosters/team-tournament-boundary-runtime-2026-10-01.json`
- `data/femebal/discovery/rosters/omitted-tournament-semantics-2026-10-01.json`
- `data/femebal/discovery/rosters/unscoped-roster-crosscheck-2026-10-01.json`

Documentación ampliada:

- `docs/femebal/rosters/reverse-membership.md`
- `docs/femebal/rosters/larrysport-1.1.3-roster-contract.md`
- `docs/femebal/rosters/membership-metadata-boundary.md`
- `docs/femebal/rosters/profile-vs-membership.md`
- `docs/femebal/rosters/runtime-one-click.md`

## Runtime permanente

La única Action de plantel que debe quedar visible al terminar la investigación es la prueba sencilla que Tomás ya ejecutó:

`.github/workflows/femebal-roster-runtime-safe.yml`

Las sondas temporales se eliminan después de guardar su evidencia.

## Seguridad

Toda la evidencia runtime se obtuvo mediante el guest legítimo de la app 1.1.3. No se escribieron datos en Supabase ni producción y no se persistieron Bearer tokens.
