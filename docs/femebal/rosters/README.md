# FEMEBAL / LarrySport 1.1.3 — PLANTELES

Handoff para Integración. Evidencia al 2026-10-01.

## Contrato confirmado

```text
clubId
  -> teamId
  -> tournamentId
  -> GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
  -> athleteId[]
```

Identidad lógica mínima de pertenencia:

```text
(teamId, tournamentId, athleteId)
```

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

## tournamentId es semánticamente obligatorio

El servidor acepta omitirlo, pero la respuesta deja de representar el plantel exacto.

| Equipo | Con torneo | Sin torneo |
| --- | ---: | ---: |
| Ferro Mayores A `1843`, Apertura LHC `775` | 16 filas / 16 IDs | 106 filas / 31 IDs |
| Ferro Mayores B `3256`, Apertura Plata `782` | 26 / 26 | 103 / 46 |
| Ballester Mayores A `3291`, Apertura LHC `775` | 25 / 25 | 131 / 30 |

Para `teamId=1843`, las 106 filas sin torneo son sólo 31 objetos de identidad únicos. Las filas repetidas de un mismo atleta son idénticas y no contienen contexto oculto de membresía.

Apertura `775` + Clausura `1204` de Ferro Mayores A forman una unión de 21 IDs únicos; la respuesta sin torneo incluye esos 21 pero además 10 IDs extra. Por eso:

- no es el plantel actual;
- no es sólo la unión de los torneos 2026 conocidos;
- deduplicarla no recupera el plantel exacto;
- su semántica histórica/interna exacta queda pendiente;
- Integración debe rechazarla como fuente de `RosterMembership`.

Pares reales pero incompatibles, por ejemplo `1843+790` o `3256+775`, responden `HTTP 200 []`. HTTP 200 no valida la relación.

Regla fail-closed:

1. resolver `teamId` exacto;
2. obtener `/teams/{teamId}/tournaments`;
3. seleccionar un `tournamentId` realmente asociado a ese equipo y al scope solicitado;
4. llamar al roster con ambos IDs;
5. no importar si falta tournamentId, el par no es válido o la respuesta viola el contrato.

## Evidencia estática APK 1.1.3

El bundle real `base.apk/assets/index.android.bundle` es Hermes bytecode v96. El análisis estático confirma:

- `getAthletesByTeam`;
- `/athletes/athletesByTeam/`;
- `?tournamentId=` dentro de la misma implementación;
- `getPositionAndNumberByAthleteIds`;
- `/athletes/formation/positionAndNumber?athleteIds=`.

No se observó en el cliente una segunda ruta evidente de membresía bajo `roster`, `squad`, `membership` o `assignment`. Esto no demuestra que el servidor carezca de rutas internas no usadas por la app.

También se desambiguaron dos superficies cercanas:

- `/matches/{id}/formation` = formación de un partido;
- `/teams/{id}/tournaments/{tournamentId}/position` = posición del equipo en el torneo.

Ninguna es una relación de plantel de temporada.

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

El `0` del mismo tournamentId sólo está probado para Ferro masculino 2026; no convertirlo en regla global.

## default-team y club-id no son el plantel

Código + runtime confirmaron:

```text
GET /athletes/{athleteId}/default-team
GET /athletes/{athleteId}/club-id
GET /users/athlete-profile/{athleteId}
```

Ejemplos:

- Bartolomeo `16284`: `default-team=369 Junior A`, pero también está en `1843/775` y `1843/1204` Mayores A LHC.
- Tonko `10565`: `default-team=3715 Juniors B`, pero también está en `369/1213` y `3256/1205`.
- Schankula `19480`: `default-team=1843 Mayores A`.

Por lo tanto, `default-team` es una asociación singular de perfil/default, no la lista de planteles. `club-id` tampoco contiene equipo+torneo.

`/users/athlete-profile/{id}` puede devolver `status`, `shirtNumber`, `height` y `position`, pero no teamId/tournamentId. `status="pending"` apareció incluso en atletas presentes en planteles y partidos; no usarlo como activo/baja del roster.

## Dorsal y posición

`formation.shirtNumber` no es dorsal histórico confiable del plantel.

Comparación Ferro vs planilla oficial 2026-03-21:

- 16 jugadores con dorsal en planilla;
- formation tiene shirtNumber no-null para 10;
- 7 coinciden;
- 3 difieren;
- 6 tienen formation null aunque la planilla tiene dorsal.

El dorsal de planilla pertenece a la participación en ese partido. No promoverlo automáticamente a `RosterMembership`.

Siguen pendientes/no expuestos en las superficies confirmadas:

- rol de membresía;
- activo/baja explícito;
- fecha alta/baja;
- ID propio de la relación;
- dorsal scopeado a team+tournament;
- posición scopeada a team+tournament.

## Contrato para Integración

Archivo machine-readable principal:

`data/femebal/discovery/rosters/roster-integration-contract-v1.json`

Modelo recomendado:

```text
Athlete(athleteId, identidad...)
AthleteProfile(athleteId, defaultTeamId?, associatedClubId?, profile fields...)
RosterMembership(teamId, tournamentId, athleteId, provenance...)
```

No inferir membresía desde `default-team`, `club-id`, perfil, ausencia en otro torneo, fechas del torneo ni `shirtNumber` de perfil/formación.

## Evidencia principal

- `data/femebal/discovery/rosters/ferro-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/sag-villa-ballester-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/ferro-2026-membership-diagnostic.json`
- `data/femebal/discovery/rosters/default-team-vs-membership-2026-10-01.json`
- `data/femebal/discovery/rosters/membership-metadata-boundary-2026-10-01.json`
- `data/femebal/discovery/rosters/ferro-formation-vs-match-dorsal-2026-03-21.json`
- `data/femebal/discovery/rosters/apk-1.1.3-static-roster-surface.json`
- `data/femebal/discovery/rosters/team-tournament-boundary-runtime-2026-10-01.json`
- `data/femebal/discovery/rosters/omitted-tournament-semantics-2026-10-01.json`
- `data/femebal/discovery/rosters/unscoped-roster-crosscheck-2026-10-01.json`

Documentación ampliada:

- `docs/femebal/rosters/larrysport-1.1.3-roster-contract.md`
- `docs/femebal/rosters/membership-metadata-boundary.md`
- `docs/femebal/rosters/profile-vs-membership.md`
- `docs/femebal/rosters/runtime-one-click.md`

## Runtime que queda visible

Se conserva únicamente la prueba sencilla que Tomás ya ejecutó y validó:

`.github/workflows/femebal-roster-runtime-safe.yml`

Las sondas temporales usadas para producir la evidencia de investigación fueron retiradas del menú de Actions después de guardar sus resultados en los artefactos anteriores.

## Seguridad

Toda la evidencia runtime se obtuvo mediante el guest legítimo de la app 1.1.3. No se escribieron datos en Supabase ni producción y no se persistieron Bearer tokens.
