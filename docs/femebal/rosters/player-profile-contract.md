# FEMEBAL / LarrySport 1.1.3 — contrato de perfil de jugador

Evidencia cerrada: 2026-10-02.

Este documento complementa el contrato de PLANTELES. No reemplaza `RosterMembership`.

## Separación de entidades

```text
Athlete
  = identidad estable por athleteId

AthleteProfile
  = datos actuales/de perfil del atleta

RosterMembership
  = (teamId, tournamentId, athleteId)

AthleteTournamentMatchStat
  = estadísticas por partido dentro de un torneo
```

No mezclar campos entre estas entidades sólo porque pertenezcan al mismo atleta.

## Identidad

```text
GET /athletes/{athleteId}
```

Campos observados:

- `id`
- `firstName`
- `lastName`
- `birthDate`
- `picture`

En el roster control Ferro `1843/775`, los 16/16 atletas tenían identidad disponible; `birthDate` y `picture` estaban no nulos en 16/16.

## Perfil

```text
GET /users/athlete-profile/{athleteId}
```

Sobre los 16 atletas del control:

| Campo | Cobertura |
| --- | ---: |
| perfil accesible | 16/16 |
| `height` no nulo | 10/16 |
| `position` no nulo | 13/16 |
| `shirtNumber` no nulo | 10/16 |
| campo `status` presente | 16/16 |

Los campos opcionales deben modelarse como nullable.

## `formation` es bulk de perfil

```text
GET /athletes/formation/positionAndNumber?athleteIds={ids}
```

Comparación con `/users/athlete-profile/{id}` sobre los mismos 16 atletas:

```text
position
  16/16 iguales incluyendo null
  13/16 no-null e iguales
  0 diferencias

shirtNumber
  16/16 iguales incluyendo null
  10/16 no-null e iguales
  0 diferencias
```

En este control completo, `formation.position` y `formation.shirtNumber` son un espejo exacto de los campos de perfil. Integración debe tratarlos como **enriquecimiento masivo del perfil del atleta**, no como posición/dorsal histórico de un `teamId+tournamentId`.

## Altura

La API entrega `height` como string.

En los 10 perfiles con altura:

```text
JSON number           0/10
JSON string          10/10
string numérico      10/10
valor parseado 1–<3  10/10
valor 100–250         0/10
```

La escala observada es consistente con metros.

Regla recomendada:

```text
height_raw = conservar string original
normalized = reemplazar coma decimal por punto si existe
h = parse numeric
aceptar para conversión sólo si 1 <= h < 3
height_cm = h * 100
```

Conservar siempre origen/proveniencia y marcar valores fuera de rango en vez de corregirlos silenciosamente.

## Posición y número

En valores no nulos del control:

- `position` es string;
- `shirtNumber` es JSON number.

Ambos son campos de perfil actuales. No están scopeados por torneo/equipo y no deben convertirse en historia de plantel.

## `default-team`

```text
GET /athletes/{athleteId}/default-team
```

Control Ferro `1843/775`:

```text
respuesta disponible      16/16
defaultTeam == 1843       13/16
defaultTeam != 1843        3/16
```

Por lo tanto `default-team` **no es el equipo del roster**. Es una asociación singular/default del perfil.

## `club-id`

```text
GET /athletes/{athleteId}/club-id
```

En el mismo control:

```text
respuesta disponible      16/16
clubId == club del roster 16/16
```

Es una asociación de perfil útil, pero por sí sola no prueba pertenencia a un equipo+torneo concreto.

## Ficha federativa

```text
GET /athletes/{athleteId}/federative-card
```

En el control:

```text
respuesta disponible                   16/16
club federativo coincide con roster    16/16
categoría federativa no nula           16/16
categoría == team.ageCategory           0/16
status no nulo                         16/16
año de habilitación no nulo            16/16
```

La categoría federativa y `team.ageCategory` usan representaciones/vocabularios distintos. **No hacer join por texto entre esos campos.**

El `status` federativo tampoco está scopeado por `teamId+tournamentId`; no significa activo/baja del roster.

Por minimización de datos, 7Metros no debería ingerir campos personales de la ficha que no sean necesarios para el producto. Las sondas de esta investigación no persistieron valores personales de la ficha.

## Modelo recomendado

```text
Athlete(
  athleteId,
  firstName,
  lastName,
  birthDate?,
  picture?
)

AthleteProfile(
  athleteId,
  height_raw?,
  height_cm?,
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
```

## No inferir

- `defaultTeamId` como único/equipo exacto del atleta;
- `club-id` como prueba de un roster concreto;
- `profile.position` como posición histórica del plantel;
- `profile.shirtNumber` como dorsal histórico;
- `profile.status` como activo/baja del roster;
- `federative status` como activo/baja del roster;
- categoría federativa = `team.ageCategory` por igualdad textual.

## Evidencia machine-readable

- `data/femebal/discovery/rosters/player-profile-integration-contract-v1.json`
- `data/femebal/discovery/rosters/player-profile-coverage-ferro-1843-775-2026-10-02.json`
- `data/femebal/discovery/rosters/player-profile-associations-ferro-1843-775-2026-10-02.json`
