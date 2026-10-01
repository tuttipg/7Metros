# FEMEBAL / LarrySport 1.1.3 — PLANTELES

Handoff de descubrimiento para Integración. Evidencia al 2026-10-01.

## Contrato confirmado

```text
clubId
  -> teamId
  -> tournamentId
  -> GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
  -> athleteId[]
```

La identidad lógica mínima de una pertenencia es:

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

Runtime y validación visual: OK.

## Segundo caso

```text
S.A.G. Villa Ballester
clubId        334
teamId        3291  (Mayores A / LHC)
tournamentId  775   (Apertura 2026)
roster        25 atletas / 25 athleteId únicos
```

Runtime: OK.

## Hallazgo crítico: un atleta puede integrar varios planteles

Ferro masculino, temporada 2026:

- 20 equipos;
- 482 membresías `(teamId,tournamentId,athleteId)`;
- 192 athleteId únicos;
- 170 athleteId repetidos en más de una membresía;
- 80 athleteId presentes en más de un teamId;
- 63 en más de una categoría;
- 17 en varios teamId manteniendo una sola categoría;
- 0 observados en dos teamId dentro del mismo tournamentId;
- 90 repetidos únicamente entre torneos del mismo teamId.

El `0` del mismo tournamentId aplica sólo al scope Ferro masculino 2026 y no debe convertirse en restricción global sin más evidencia.

## Metadata de membresía

En las superficies confirmadas de 1.1.3:

- roster devuelve identidad del atleta;
- `/athletes/{athleteId}` devuelve identidad del atleta;
- formación devuelve `shirtNumber` + `position` por athleteId, sin teamId/tournamentId.

No están expuestos en estas superficies:

- rol de membresía;
- activo/baja explícito;
- fechas de alta/baja;
- ID propio de la relación;
- dorsal scopeado a team+tournament;
- posición scopeada a team+tournament.

Esto no prueba que no existan en otra superficie todavía no confirmada; por ahora quedan PENDIENTES y no deben inferirse.

## Dorsal

`formation.shirtNumber` **NO es un dorsal histórico confiable del plantel**.

Comparación Ferro vs planilla oficial 2026-03-21:

- 16 atletas en la planilla;
- formation tiene shirtNumber no-null para 10;
- 7 coinciden con el dorsal del partido;
- 3 difieren;
- 6 tienen formation shirtNumber null aunque la planilla tiene dorsal.

El dorsal de planilla debe quedar asociado a participación/partido. No copiarlo automáticamente a RosterMembership.

## Archivos canónicos

### Documentación

- `docs/femebal/rosters/larrysport-1.1.3-roster-contract.md`
- `docs/femebal/rosters/membership-metadata-boundary.md`
- `docs/femebal/rosters/runtime-one-click.md`

### Evidencia machine-readable

- `data/femebal/discovery/rosters/ferro-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/sag-villa-ballester-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/ferro-2026-membership-diagnostic.json`
- `data/femebal/discovery/rosters/membership-metadata-boundary-2026-10-01.json`
- `data/femebal/discovery/rosters/ferro-formation-vs-match-dorsal-2026-03-21.json`

### Runtime SAFE

- `.github/workflows/femebal-roster-runtime-safe.yml`
- `.github/workflows/femebal-roster-shared-athletes-safe.yml`
- `.github/workflows/femebal-roster-membership-metadata-safe.yml`

## Regla de integración

Guardar hechos, no inferencias:

```text
Athlete(athleteId, identidad...)
RosterMembership(teamId, tournamentId, athleteId, provenance...)
```

Resolver `clubId`, temporada, categoría, división y rama a través del equipo/torneo correspondiente.

No convertir presencia/ausencia en activo/baja, ni fechas del torneo en fechas de membresía, ni `formation.shirtNumber` en dorsal histórico.

## Seguridad

Toda la evidencia runtime se obtuvo mediante el guest legítimo de la app 1.1.3. No se escribieron datos en Supabase ni producción y no se persistieron Bearer tokens.
