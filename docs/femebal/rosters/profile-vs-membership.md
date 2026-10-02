# FEMEBAL 1.1.3 — perfil/default-team vs pertenencia a plantel

Fecha de evidencia: 2026-10-01.

## Superficies confirmadas en código y runtime

La app 1.1.3 expone, además del roster exacto, estas lecturas relacionadas con un atleta:

```text
GET /athletes/{athleteId}/default-team
GET /athletes/{athleteId}/club-id
GET /users/athlete-profile/{athleteId}
```

Ninguna recibe `tournamentId`.

## default-team no es el plantel

### Juan Martín Bartolomeo — athleteId 16284

Runtime:

```text
default-team -> teamId 369 / Junior A / Ferro
club-id      -> 335 / Ferro
```

Pero el mismo athleteId está confirmado simultáneamente en varias membresías 2026, entre ellas:

```text
369  + 790  -> Junior A / Apertura
369  + 1213 -> Junior A / Clausura
1843 + 775  -> Mayores A LHC / Apertura
1843 + 1204 -> Mayores A LHC / Clausura
```

Por lo tanto, `default-team=369` no significa que el atleta no integre `teamId=1843`.

### Tonko Simunovic Granero — athleteId 10565

Runtime:

```text
default-team -> teamId 3715 / Juniors B / Ferro
club-id      -> 335 / Ferro
```

Pero hay membresías confirmadas en:

```text
369  + 1213 -> Junior A / Clausura
3715 + 834  -> Juniors B / Apertura
3715 + 1223 -> Juniors B / Clausura
3256 + 1205 -> Mayores B / Clausura Plata
```

La misma conclusión se repite: `default-team` es una relación singular de perfil/default, no la lista de planteles del atleta.

## club-id tampoco alcanza

`club-id` devolvió `335` para Bartolomeo, Tonko y Schankula. Es útil como dato de club asociado, pero no contiene temporada, categoría, división, torneo ni equipo concreto. No puede generar `RosterMembership` por sí solo.

## user-athlete-profile

La lectura `GET /users/athlete-profile/{athleteId}` puede exponer campos como:

- `status`;
- `shirtNumber`;
- `height`;
- `position`;
- preferencias de imagen y datos sociales.

En los tres controles consultados el campo `status` fue `pending`, incluidos atletas que aparecen en planteles oficiales y partidos. Además la respuesta no lleva `teamId` ni `tournamentId`.

Conclusión segura: este `status` **no debe interpretarse como estado activo/baja de un plantel**. Es un campo del perfil de usuario/atleta y no está scopeado a una membresía deportiva.

Por el mismo motivo, `shirtNumber` y `position` de esta superficie no son automáticamente atributos históricos de `(teamId,tournamentId,athleteId)`.

## Regla para Integración

Mantener conceptos separados:

```text
Athlete
  athleteId
  identidad

AthleteProfile
  athleteId
  defaultTeamId?       # perfil/default, no membresía
  associatedClubId?    # perfil/asociación, no membresía
  shirtNumber?         # no tournament-scoped
  position?            # no tournament-scoped
  profileStatus?       # no roster status

RosterMembership
  teamId
  tournamentId
  athleteId
```

La única fuente confirmada para la última relación continúa siendo:

```text
GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
```

No promover automáticamente `defaultTeamId`, `club-id`, `profile.status`, `shirtNumber` ni `position` a atributos de una membresía concreta.
