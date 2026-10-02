# FEMEBAL Community / LarrySport 1.1.3 — contrato de planteles

Estado actualizado: 2026-10-02.

Rama: `research/femebal-rosters-1.1.3`.

Este documento cubre únicamente PLANTELES. Toda validación runtime usó el guest legítimo de la app 1.1.3 y lecturas GET. No se escribió en Supabase ni producción.

## Contrato principal

La identidad de una pertenencia deportiva observada es:

```text
(teamId, tournamentId, athleteId)
```

No modelar `athleteId -> clubId` ni `athleteId -> teamId` como relaciones permanentes 1:1.

### Forward: enumerar roster exacto

```text
GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
```

Respuesta: array directo de identidades Athlete con `id`, `firstName`, `lastName`, `birthDate`, `picture`.

`tournamentId` es semánticamente obligatorio para producir hechos `RosterMembership`.

### Reverse: descubrir/validar pertenencias expuestas

```text
GET /athletes/{athleteId}/tournaments
```

Respuesta observada: array de filas `{team,tournament}`.

Se validaron 13/13 pares seleccionados contra el roster forward y luego el cierre completo de dos rosters Apertura 2026:

```text
Ferro 1843/775      16/16
Ballester 3291/775  25/25
TOTAL               41/41, 0 faltantes
```

El reverse es un índice fuerte de membresías, pero no debe asumirse como historial global exhaustivo para toda asociación antigua.

## Resolución del scope

Para:

```text
club + temporada + categoría + división + rama
```

resolver:

```text
clubId
 -> teamId
 -> tournamentId
 -> GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
 -> athleteId[]
```

Usar IDs y metadata estructurada. Si existen A/B/C/D con el mismo scope humano, fallar cerrado y conservar el discriminador de equipo.

## Controles E2E

### Ferro Carril Oeste

```text
clubId       335
teamId       1843
team         Mayores A
categoryId   100
divisionId   421
rama         Masculino
tournamentId 775  (Apertura 2026)
roster       16 athleteId únicos
```

### S.A.G. Villa Ballester

```text
clubId       334
teamId       3291
team         Mayores A
tournamentId 775  (Apertura 2026)
roster       25 athleteId únicos
```

## Un atleta puede integrar varios planteles

En Ferro masculino 2026 se observaron 20 equipos, 482 membresías `(teamId,tournamentId,athleteId)` y 192 athleteId únicos. Entre ellos, 80 athleteId aparecen en más de un teamId y 63 cruzan categoría.

Por eso Athlete y RosterMembership deben ser entidades separadas.

## `/teams/{teamId}/tournaments` no es historial exhaustivo

Para `teamId=1843`, el listado normal expuso `775` y `1204`, pero se confirmaron también pares válidos de otros torneos, entre ellos `776` y torneos 2025 (`218`, `219`, `526`).

No descartar un par reverse válido sólo porque no aparezca en `/teams/{teamId}/tournaments`.

## Semántica del endpoint sin torneo

```text
GET /athletes/athletesByTeam/1843
```

produjo 106 filas / 31 IDs únicos.

Se demostró que esas 106 filas son exactamente la concatenación multiconjunto de seis rosters exactos:

```text
218  -> 20
219  -> 16
526  -> 19
775  -> 16
776  -> 16
1204 -> 19
TOTAL  106
```

Coinciden tanto el conjunto de athleteIds como la multiplicidad individual de cada athleteId. El contexto `tournamentId` se pierde en la respuesta sin scope.

Regla: nunca crear `RosterMembership` desde la variante sin tournamentId, ni siquiera después de deduplicar.

## Dorsal y posición

```text
GET /athletes/formation/positionAndNumber?athleteIds={ids}
```

expone `shirtNumber` y `position`, pero no recibe `teamId` ni `tournamentId`.

Además, el dorsal de formación ya fue comparado contra una planilla oficial y no es históricamente consistente para todos los jugadores. Tratar esos valores como enriquecimiento/perfil del atleta, no como propiedades históricas de `RosterMembership`.

## Estadísticas de atleta por torneo

```text
GET /athletes/{athleteId}/tournaments/{tournamentId}/stats
```

está confirmado código + runtime. Cada fila contiene:

```text
matchId
goals
sanctions.yellowCards
sanctions.redCards
sanctions.blueCards
sanctions.twoMinuteSuspensions
```

Es performance/participación por partido. Debe modelarse aparte:

```text
AthleteTournamentMatchStat(athleteId,tournamentId,matchId,goals,sanctions)
```

No contiene rol, dorsal de roster, posición de roster, altas/bajas ni ID de membresía.

## Perfil y superficies auxiliares

Confirmados:

```text
GET /athletes/{athleteId}
GET /athletes/{athleteId}/default-team
GET /athletes/{athleteId}/club-id
GET /users/athlete-profile/{athleteId}
GET /athletes/{athleteId}/federative-card
GET /athletes/{athleteId}/socials
GET /athletes/{athleteId}/mvp-awards
```

Ninguna representa una relación `(teamId,tournamentId,athleteId)`.

La ficha federativa puede exponer categoría, club, año de habilitación y estado, pero no está scopeada por team+tournament. Su estado no debe convertirse en activo/baja de roster. La sonda de PLANTELES registró sólo estructura de esa respuesta, no valores personales.

## Frontera cerrada de metadata de membresía

Después de análisis estático del bundle Hermes v96 y runtime sobre las superficies utilizadas por el cliente 1.1.3, estos campos quedan como:

```text
not_exposed_in_confirmed_1_1_3_client_surfaces
```

- rol de membresía;
- activo/inactivo/baja en un plantel concreto;
- fecha de alta;
- fecha de baja/fin;
- ID propio de la relación;
- dorsal scopeado por team+tournament;
- posición scopeada por team+tournament.

Esto es una frontera sobre el **cliente distribuido 1.1.3 y sus superficies confirmadas**. No afirma que no exista alguna API interna/no usada por la app.

## Modelo recomendado

```text
Athlete(athleteId, identidad...)
AthleteProfile(athleteId, profile/federative fields..., provenance...)
RosterMembership(teamId, tournamentId, athleteId, provenance...)
AthleteTournamentMatchStat(athleteId, tournamentId, matchId, goals, sanctions...)
```

No inferir atributos de RosterMembership desde default-team, club-id, profile status, estado federativo, fechas del torneo, `formation.shirtNumber`, `formation.position` ni ausencia en otro torneo.

## Fuentes canónicas del repo

- `data/femebal/discovery/rosters/roster-integration-contract-v1.json`
- `data/femebal/discovery/rosters/athlete-scoped-surfaces-boundary-2026-10-02.json`
- `data/femebal/discovery/rosters/apk-1.1.3-static-roster-surface.json`
- `data/femebal/discovery/rosters/full-bidirectional-closure-2026-10-01.json`
- `data/femebal/discovery/rosters/ferro-1843-unscoped-multiset-semantics-2026-10-01.json`
- `docs/femebal/rosters/membership-metadata-boundary.md`
- `docs/femebal/rosters/reverse-membership.md`
- `docs/femebal/rosters/unscoped-roster-semantics.md`

## Seguridad

No se persistieron tokens de guest, cookies ni credenciales. Las sondas temporales se retiran al terminar y se conserva únicamente el workflow permanente de validación simple del roster.
