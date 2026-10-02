# FEMEBAL 1.1.3 — frontera de metadata de membresía

Fecha de cierre: 2026-10-02.

Alcance: exclusivamente PLANTELES. Guest legítimo 1.1.3. Sin escrituras en Supabase o producción.

## Pregunta

Una vez confirmada la identidad de membresía:

```text
(teamId, tournamentId, athleteId)
```

¿las superficies usadas por el cliente 1.1.3 exponen además rol, activo/baja de plantel, fechas de alta/baja, ID propio de la relación, dorsal histórico de plantel o posición histórica de plantel?

## Superficies comprobadas

### Roster exacto

```text
GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
```

La fila contiene únicamente identidad del atleta: `id`, `firstName`, `lastName`, `birthDate`, `picture`. No hay metadata adicional de la relación.

### Perfil de atleta

```text
GET /athletes/{athleteId}
```

Claves observadas: `id`, `firstName`, `lastName`, `birthDate`, `picture`. Es identidad de atleta, no membresía.

### Enriquecimiento posición/número

```text
GET /athletes/formation/positionAndNumber?athleteIds={ids}
```

Campos observados: `shirtNumber`, `position`.

El request no recibe `teamId` ni `tournamentId`; por eso esos valores no se pueden atribuir como historia de una membresía concreta. La comparación previa contra planilla oficial también mostró que `shirtNumber` no es un dorsal histórico confiable.

### Perfil de usuario-atleta

```text
GET /users/athlete-profile/{athleteId}
```

Puede exponer `height`, `position`, `shirtNumber`, `status` y metadata de avatar/social. Tampoco recibe `teamId+tournamentId`. Un `status` de perfil no significa activo/baja en un plantel.

### Estadísticas de atleta por torneo

```text
GET /athletes/{athleteId}/tournaments/{tournamentId}/stats
```

Se verificó runtime con cuatro combinaciones reales. Cada fila contiene:

```text
matchId
goals
sanctions.yellowCards
sanctions.redCards
sanctions.blueCards
sanctions.twoMinuteSuspensions
```

Controles: `16284/775` = 15 filas, `16284/790` = 15, `16284/1204` = 8 y `19480/776` = 1.

Es una superficie de rendimiento/participación por partido dentro del torneo, no metadata de `RosterMembership`.

### Ficha federativa

```text
GET /athletes/{athleteId}/federative-card
```

Se inspeccionó únicamente la estructura y no se registraron valores personales. La respuesta contiene metadata federativa/de identidad, incluida categoría, club, año de habilitación y estado, pero no `teamId` ni `tournamentId`.

Por lo tanto, el estado de la ficha federativa no prueba activo/baja de una membresía de equipo+torneo.

### Socials y MVP

```text
GET /athletes/{athleteId}/socials
GET /athletes/{athleteId}/mvp-awards
```

`socials` expone seguidores/links y MVP es una colección de premios. No aportan metadata de membresía.

## Evidencia estática del APK

El bundle real 1.1.3 es Hermes bytecode v96. Se localizaron las superficies anteriores y el flujo de `TeamFormation`, que conserva `teamId+tournamentId` para obtener el roster y luego pide `positionAndNumber` por separado como enriquecimiento de atleta.

La tabla de strings y el análisis dirigido no mostraron una segunda ruta evidente de gestión de membresía bajo términos `roster`, `squad`, `membership` o `assignment`.

Esto limita lo que el cliente distribuido 1.1.3 expone; no es una afirmación sobre recursos internos/no documentados del servidor que la app no utilice.

## Estado cerrado para el contrato 1.1.3

En las superficies confirmadas del cliente 1.1.3 **no están expuestos**:

- rol de membresía;
- activo/inactivo/baja del atleta en un `teamId+tournamentId`;
- fecha de alta de la relación;
- fecha de baja/fin de la relación;
- ID propio de la relación;
- dorsal scopeado a `teamId+tournamentId`;
- posición scopeada a `teamId+tournamentId`.

Ya no quedan como “campo pendiente por inferir”. Quedan como:

```text
not_exposed_in_confirmed_1_1_3_client_surfaces
```

Si otro frente descubre en el futuro una ruta concreta usada legítimamente por una versión nueva o una superficie adicional, el contrato puede ampliarse con nueva evidencia.

## Modelo recomendado

```text
Athlete(athleteId, identidad...)
RosterMembership(teamId, tournamentId, athleteId, provenance...)
AthleteProfile(athleteId, profile/federative fields..., provenance...)
AthleteTournamentMatchStat(athleteId, tournamentId, matchId, goals, sanctions...)
```

No mezclar esas entidades. En especial, no promover `profile.position`, `formation.shirtNumber` ni el estado federativo a propiedades históricas de `RosterMembership`.

## Evidencia

- `data/femebal/discovery/rosters/membership-metadata-boundary-2026-10-01.json` — primera frontera runtime.
- `data/femebal/discovery/rosters/athlete-scoped-surfaces-boundary-2026-10-02.json` — cierre ampliado con stats y superficies auxiliares.
- `data/femebal/discovery/rosters/apk-1.1.3-static-roster-surface.json` — evidencia estática del cliente.
