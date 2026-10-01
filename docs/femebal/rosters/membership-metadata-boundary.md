# FEMEBAL 1.1.3 — frontera de metadata de membresía

Fecha: 2026-10-01

Alcance: exclusivamente PLANTELES. Guest legítimo 1.1.3. Sin escrituras en Supabase o producción.

## Pregunta

Una vez confirmada la identidad de membresía `(teamId, tournamentId, athleteId)`, ¿las superficies que usa el cliente 1.1.3 exponen además dorsal de plantel, posición de plantel, rol, activo/baja o fechas de alta/baja?

## Prueba runtime

Se usaron dos atletas que ya están confirmados en múltiples planteles reales:

- `16284` Juan Martín Bartolomeo: Mayores A `1843/775` y Junior A `369/790`, entre otras membresías 2026.
- `10565` Tonko Simunovic Granero: Junior A `369/1213`, Juniors B `3715/1223` y Mayores B `3256/1205`.

Se inspeccionaron sólo endpoints ya confirmados por el cliente; no se adivinaron rutas nuevas.

### `GET /athletes/{athleteId}`

Para ambos atletas, las únicas claves top-level observadas fueron:

- `id`
- `firstName`
- `lastName`
- `birthDate`
- `picture`

No apareció ninguna ruta/campo con club, team, tournament, role, status, active, shirt number, position, start/end, created/updated o ID de relación.

Conclusión: el perfil individual es identidad de atleta; no es una entidad de membresía.

### `GET /athletes/formation/positionAndNumber?athleteIds=...`

Respuesta observada:

- `16284`: `shirtNumber=16`, `position=Arquero`.
- `10565`: `shirtNumber=null`, `position=null`.

El request no contiene `teamId` ni `tournamentId`.

Conclusión: estos datos no pueden atribuirse de forma segura a una membresía histórica concreta. `shirtNumber` no es un dorsal de `(teamId,tournamentId,athleteId)` demostrado.

### `GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}`

Se reconfirmaron las membresías concretas de ambos atletas en cinco combinaciones team+tournament distintas. Las filas del roster siguen conteniendo únicamente identidad del atleta (`id`, nombre, apellido, nacimiento, foto), sin metadata adicional de la relación.

## Estado exacto

### Confirmado runtime: no expuesto en estas superficies

- role de membresía;
- estado activo/inactivo/baja del jugador en ese plantel;
- fecha de alta de la membresía;
- fecha de baja/fin de la membresía;
- createdAt/updatedAt de la relación;
- ID propio de la relación;
- dorsal histórico scopeado a team+tournament;
- posición scopeada a team+tournament.

### Pendiente

Que estos campos no aparezcan en roster/perfil/formación **no prueba que no existan en ningún recurso del backend**. Hasta encontrar evidencia en código 1.1.3 o runtime de una ruta concreta, deben quedar como `PENDIENTE`, no inferirse.

## Regla para Integración

Guardar sólo hechos demostrados:

`RosterMembership(teamId, tournamentId, athleteId)`

No completar por inferencia:

- `active=true` sólo porque el atleta aparece;
- `baja=true` porque desaparece en otro torneo;
- `startDate/endDate` usando fechas del torneo;
- `dorsal` usando `formation.shirtNumber`;
- `position` como si fuera histórica del plantel.

Evidencia machine-readable: `data/femebal/discovery/rosters/membership-metadata-boundary-2026-10-01.json`.
