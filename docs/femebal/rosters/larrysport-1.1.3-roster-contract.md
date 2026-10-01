# FEMEBAL Community / LarrySport 1.1.3 — contrato de planteles

Fecha de evidencia: 2026-10-01

Rama de investigación: `research/femebal-rosters-1.1.3`

Este documento cubre únicamente planteles. No se cargaron datos en Supabase y no se modificó el PR #34.

## Resultado E2E confirmado

La identidad correcta de una pertenencia deportiva no es `athleteId -> clubId`. Para la API 1.1.3, el plantel observado queda determinado por la combinación de equipo y torneo:

`club -> teamId -> tournamentId -> roster -> athleteId`

Para Ferro Carril Oeste, Mayores A, Liga de Honor Hipotecario Seguros, masculino, Apertura 2026:

- `clubId = 335`
- `teamId = 1843`
- `tournamentId = 775`
- roster: 16 atletas
- athleteIds únicos: 16

Endpoint exacto:

`GET /athletes/athletesByTeam/1843?tournamentId=775`

Respuesta observada: array JSON directo de objetos Athlete. Cada elemento contiene `id`, `firstName`, `lastName`, `birthDate` y `picture`.

## Hallazgos confirmados en código 1.1.3

### Resolver equipo

El cliente lista equipos con `GET /teams` y filtros de lectura que incluyen `club`, `category`, `gender` y opcionalmente `division`.

Para el ejemplo objetivo, la consulta runtime `club=335`, `category=100`, `gender=M` devolvió tres equipos Mayores masculinos de Ferro, cada uno con división distinta. Esto permite seleccionar LHC por metadata, no por nombre aproximado.

### Resolver torneos del equipo

El cliente implementa:

`GET /teams/{teamId}/tournaments`

La respuesta contiene el objeto tournament con `id`, `name`, `ageCategory`, `season`, `gender`, `startDate`, `status` y `division`, suficiente para distinguir Apertura/Clausura y temporada.

### Resolver plantel

El cliente implementa `getAthletesByTeam(teamId, tournamentId)` como:

`GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}`

No se observaron parámetros de paginación en este método del cliente.

### Resolver perfil individual

El cliente implementa:

`GET /athletes/{athleteId}`

### Formación / posición y número

El cliente implementa:

`GET /athletes/formation/positionAndNumber?athleteIds={ids separados por coma}`

Antes de llamar, el cliente deduplica IDs y filtra valores no finitos. La respuesta es un mapa por athleteId con, al menos, `shirtNumber` y `position`.

Importante: este endpoint recibe solamente athleteIds. No recibe teamId ni tournamentId. Por eso `shirtNumber` y `position` no quedan demostrados como atributos de una membresía histórica concreta.

### Guest onboarding legítimo

La app 1.1.3 implementa `POST /init-onboarding` sin body y con `skipAuth`. La respuesta aporta el access token que usa el cliente para las lecturas autenticadas posteriores. En las pruebas runtime el token se mantuvo efímero, nunca se imprimió ni persistió.

## Hallazgos confirmados runtime

### Ferro Carril Oeste

`GET /teams?club=335&category=100&gender=M` devolvió:

| teamId | equipo | división | rama |
| --- | --- | --- | --- |
| 1843 | Mayores A | LHC Hipotecario Seguros | Masculino |
| 3256 | Mayores B | Liga de Honor Plata | Masculino |
| 3257 | Mayores C | 1º División | Masculino |

Por lo tanto, Ferro + Mayores + LHC + Caballeros resuelve inequívocamente a `teamId=1843`.

`GET /teams/1843/tournaments` devolvió, entre otros:

| tournamentId | torneo | temporada | división | rama | estado |
| --- | --- | --- | --- | --- | --- |
| 775 | Torneo Metropolitano Apertura | 2026 | LHC Hipotecario Seguros | Masculino | finished |
| 1204 | Torneo Metropolitano Clausura | 2026 | LHC Hipotecario Seguros | Masculino | active |

Por lo tanto, Apertura 2026 resuelve a `tournamentId=775`.

### Plantel Ferro Apertura 2026

`GET /athletes/athletesByTeam/1843?tournamentId=775` respondió HTTP 200 con 16 filas y 16 athleteIds únicos:

`16284, 16299, 16355, 19470, 19472, 19475, 19477, 19479, 19480, 19483, 19484, 28365, 28398, 28403, 57796, 66223`

Nombres:

- 16284 — Juan Martín Bartolomeo
- 16299 — Matias Jacquemin
- 16355 — Ivan Luca Umansky Gavi
- 19470 — Juan Pablo Aguero
- 19472 — Mariano Bustamante
- 19475 — Santiago Duhau
- 19477 — Martín Fariña
- 19479 — Julián Santos
- 19480 — Valentín Schankula
- 19483 — Agustín Unzner
- 19484 — Fausto Vázquez Palmieri
- 28365 — Juan Francisco Ceccardi
- 28398 — Ignacio Goñi
- 28403 — Emiliano Rubio
- 57796 — Atilio Cocco
- 66223 — Federico Agustin Pallero

Los 16 IDs se consultaron además contra `GET /athletes/{athleteId}`. Los 16 coincidieron exactamente en id, nombre y apellido con el roster.

El fixture de control ya existente en el repo para Argentinos Juniors 20–27 Ferro del 2026-03-21 contiene los mismos 16 nombres de Ferro, lo que aporta una validación adicional de que atletas de este roster aparecen en una planilla oficial de la competencia. Esto no convierte una planilla de partido en fuente de plantel.

### Relación temporal demostrada

Para el mismo `teamId=1843`:

- Apertura (`tournamentId=775`): 16 atletas.
- Clausura (`tournamentId=1204`): 19 atletas.
- comunes: 14.
- sólo Apertura: `16299`, `19483`.
- sólo Clausura: `16285`, `16306`, `19481`, `22197`, `22199`.

Esto demuestra en runtime que la pertenencia debe modelarse por torneo. La ausencia de un atleta en otro torneo no debe interpretarse por sí sola como baja: el endpoint no devuelve motivo ni estado de baja.

### Segundo club: S.A.G. Villa Ballester

`clubId=334`.

Para Mayores masculino:

- `teamId=3291` — Mayores A — LHC Hipotecario Seguros.
- `teamId=3292` — Mayores B — Liga de Honor Plata.
- `teamId=3293` — Mayores C — 2º División.
- `teamId=3294` — Mayores D — 3º División.

El equipo LHC `3291` participa en el mismo Apertura 2026 `tournamentId=775`.

`GET /athletes/athletesByTeam/3291?tournamentId=775` devolvió 25 atletas y 25 athleteIds únicos. No hubo athleteIds compartidos con el roster Ferro 1843/775 en esta comparación concreta.

## Dorsal y posición: frontera actual

La llamada de formación para los 16 athleteIds de Ferro devolvió valores como:

- athleteId 16284, Juan Martín Bartolomeo: `shirtNumber=16`, `position=Arquero`.
- athleteId 19480, Valentín Schankula: `shirtNumber=8`, `position=Extremo Izquierdo`.
- athleteId 19483, Agustín Unzner: `shirtNumber=17`, `position=Lateral Derecho`.

Sin embargo, el endpoint de formación no recibe teamId/tournamentId y el número puede diferir del dorsal usado en una planilla de partido. Por ejemplo, Bartolomeo aparece con dorsal 1 en el fixture de control existente, mientras formación devuelve 16.

Conclusión:

- `position`: disponible, pero su semántica temporal/de plantel no está demostrada; tratar como snapshot de formación del atleta hasta nueva evidencia.
- `shirtNumber`: disponible, pero NO debe mapearse como dorsal histórico del plantel.
- dorsal específico de la relación team+tournament+athlete: pendiente.

## Paginación, duplicados y jugadores compartidos

- Roster endpoint: respuesta array directa; no se observó envelope `count/limit/skip` ni parámetros de paginación en el método del cliente.
- Ferro 1843/775: 16 filas / 16 IDs únicos; sin duplicados.
- Ballester 3291/775: 25 filas / 25 IDs únicos; sin duplicados.
- Ferro vs Ballester en 775: 0 athleteIds compartidos en este par.
- No se generaliza este último resultado a todos los equipos de FEMEBAL.

## Modelo recomendado para Integración

Separar identidad de membresía.

### Athlete

Identidad estable del deportista:

- athleteId
- firstName
- lastName
- birthDate/picture sólo si el producto realmente los necesita

### RosterMembership

La pertenencia concreta debe tener como identidad lógica, como mínimo:

`(teamId, tournamentId, athleteId)`

Y conservar por join:

- clubId
- teamId
- tournamentId
- athleteId
- seasonId / season
- categoryId
- divisionId
- gender/rama
- source endpoint
- observedAt

No derivar `clubId` permanente dentro de Athlete. Un atleta puede cambiar de roster entre torneos y el backend ya demuestra conjuntos distintos para un mismo teamId entre Apertura y Clausura.

## Estado de cada requisito

| Requisito | Estado |
| --- | --- |
| endpoint exacto roster | CONFIRMADO CÓDIGO + RUNTIME |
| parámetros teamId+tournamentId | CONFIRMADO CÓDIGO + RUNTIME |
| clubId -> teamId exacto | CONFIRMADO RUNTIME |
| teamId -> tournamentId exacto | CONFIRMADO CÓDIGO + RUNTIME |
| athleteId del plantel | CONFIRMADO CÓDIGO + RUNTIME |
| plantel completo Ferro | CONFIRMADO RUNTIME |
| segundo club | CONFIRMADO RUNTIME |
| athleteId coincide con perfil individual | CONFIRMADO RUNTIME, 16/16 Ferro |
| paginación del roster | NO OBSERVADA; cliente no expone params de paginación |
| duplicados | NO OBSERVADOS en 16/16 Ferro ni 25/25 Ballester |
| relación temporal | CONFIRMADO RUNTIME por diferencia Apertura/Clausura |
| posición | CONFIRMADA como dato de formación; alcance temporal DE PLANTEL PENDIENTE |
| dorsal histórico de plantel | PENDIENTE; `shirtNumber` no está team/tournament-scoped |
| rol | PENDIENTE |
| activo/baja explícito | PENDIENTE |
| fecha alta/baja de membresía | PENDIENTE |
| jugadores compartidos globalmente entre equipos | PENDIENTE; 0 compartidos sólo en Ferro/Ballester 775 |

## Artefactos

- `data/femebal/discovery/rosters/ferro-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/sag-villa-ballester-mayores-lhc-apertura-2026.json`
- `.github/workflows/femebal-roster-runtime-safe.yml` — reproducción manual, sin tokens persistidos.

## Intervención

No se requiere intervención de Tomás para reproducir la cadena validada mientras el guest onboarding siga disponible con el contrato observado en 1.1.3.
