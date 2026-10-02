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

## Regla crítica: tournamentId es semánticamente obligatorio

El backend no rechaza una llamada sin `tournamentId`, pero esa respuesta **NO representa el plantel exacto**.

Controles runtime:

| Equipo | Plantel exacto con torneo | Respuesta sin torneo |
| --- | ---: | ---: |
| Ferro Mayores A, `1843`, Apertura LHC `775` | 16 filas / 16 IDs | 106 filas / 31 IDs |
| Ferro Mayores B, `3256`, Apertura Plata `782` | 26 / 26 | 103 / 46 |
| Ballester Mayores A, `3291`, Apertura LHC `775` | 25 / 25 | 131 / 30 |

Para Ferro `teamId=1843`, la respuesta sin torneo tiene 106 filas pero sólo 31 objetos JSON únicos. Las repeticiones de un mismo athleteId son objetos de identidad idénticos; no contienen un campo oculto de torneo, rol, estado ni pertenencia.

La unión de los dos planteles 2026 conocidos de `1843` —Apertura `775` + Clausura `1204`— contiene 21 athleteId únicos. Los 21 están dentro de la respuesta sin torneo, pero ésta agrega otros 10 IDs y repeticiones múltiples. Por lo tanto:

- no es el plantel actual;
- no es simplemente la unión de Apertura + Clausura 2026;
- deduplicarla tampoco recupera el plantel exacto;
- su semántica histórica/interna exacta queda PENDIENTE;
- **Integración debe rechazar cualquier roster exacto obtenido sin tournamentId.**

Además, pares conocidos pero incompatibles como `teamId=1843 + tournamentId=790` y `teamId=3256 + tournamentId=775` responden `HTTP 200 []`. HTTP 200 por sí solo no prueba que el par sea válido.

Regla fail-closed:

1. resolver el `teamId` exacto;
2. consultar `/teams/{teamId}/tournaments`;
3. resolver el `tournamentId` dentro de los torneos de ese equipo;
4. recién entonces llamar al roster;
5. si falta tournamentId, el par no pertenece al equipo o la respuesta no cumple el contrato, no importar.

## Evidencia estática APK 1.1.3

El bundle real `base.apk/assets/index.android.bundle` es Hermes bytecode v96. El análisis estático de su tabla de strings y operandos confirma:

- método cliente `getAthletesByTeam`;
- ruta `/athletes/athletesByTeam/`;
- construcción con `?tournamentId=` dentro de la misma implementación;
- método `getPositionAndNumberByAthleteIds` y ruta `/athletes/formation/positionAndNumber?athleteIds=`.

En la superficie del cliente 1.1.3 no se observó una segunda ruta evidente de membresía bajo términos `roster`, `squad`, `membership` o `assignment`. `plantel` aparece sólo como texto de interfaz. Esto limita lo que está confirmado en el cliente: **no demuestra que el servidor no tenga alguna ruta interna/no utilizada por la app**.

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
- `data/femebal/discovery/rosters/apk-1.1.3-static-roster-surface.json`
- `data/femebal/discovery/rosters/team-tournament-boundary-runtime-2026-10-01.json`
- `data/femebal/discovery/rosters/omitted-tournament-semantics-2026-10-01.json`
- `data/femebal/discovery/rosters/unscoped-roster-crosscheck-2026-10-01.json`

### Runtime SAFE

- `.github/workflows/femebal-roster-runtime-safe.yml`
- `.github/workflows/femebal-roster-shared-athletes-safe.yml`
- `.github/workflows/femebal-roster-membership-metadata-safe.yml`
- `.github/workflows/femebal-roster-boundary-safe.yml`
- `.github/workflows/femebal-roster-no-tournament-semantics-safe.yml`
- `.github/workflows/femebal-roster-unscoped-shape-safe.yml`
- `.github/workflows/femebal-roster-unscoped-crosscheck-safe.yml`

## Regla de integración

Guardar hechos, no inferencias:

```text
Athlete(athleteId, identidad...)
RosterMembership(teamId, tournamentId, athleteId, provenance...)
```

Resolver `clubId`, temporada, categoría, división y rama a través del equipo/torneo correspondiente.

No convertir presencia/ausencia en activo/baja, ni fechas del torneo en fechas de membresía, ni `formation.shirtNumber` en dorsal histórico.

Nunca aceptar la variante sin `tournamentId` como fuente de `RosterMembership`, ni siquiera deduplicándola.

## Seguridad

Toda la evidencia runtime se obtuvo mediante el guest legítimo de la app 1.1.3. No se escribieron datos en Supabase ni producción y no se persistieron Bearer tokens.
