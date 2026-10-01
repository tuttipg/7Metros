# FEMEBAL Community / LarrySport 1.1.3 — contrato de planteles

Fecha de evidencia: 2026-10-01

Rama de investigación: `research/femebal-rosters-1.1.3`

Este documento cubre únicamente planteles. No se cargaron datos en Supabase y no se modificó el PR #34.

## Resultado E2E confirmado

La identidad correcta de una pertenencia deportiva no es `athleteId -> clubId` ni `athleteId -> teamId`.

Para la API 1.1.3, el plantel observado queda determinado por la combinación:

`club -> teamId -> tournamentId -> roster -> athleteId`

La identidad lógica mínima de una membresía es:

`(teamId, tournamentId, athleteId)`

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

El endpoint de equipos sí está paginado y devuelve `count`, `limit`, `skip` e `items`.

Para el ejemplo objetivo, la consulta runtime `club=335`, `category=100`, `gender=M` devolvió tres equipos Mayores masculinos de Ferro, cada uno con división distinta. Esto permite seleccionar LHC por metadata, no por nombre aproximado.

### Resolver torneos del equipo

El cliente implementa:

`GET /teams/{teamId}/tournaments`

La respuesta contiene el objeto tournament con `id`, `name`, `ageCategory`, `season`, `gender`, `startDate`, `status` y `division`, suficiente para distinguir Apertura/Clausura y temporada.

El `status` observado aquí pertenece al torneo. No debe interpretarse como estado activo/baja de un jugador.

### Resolver plantel

El cliente implementa `getAthletesByTeam(teamId, tournamentId)` como:

`GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}`

No se observaron parámetros de paginación en este método del cliente. Runtime devuelve un array directo.

### Resolver perfil individual

El cliente implementa:

`GET /athletes/{athleteId}`

### Formación / posición y número

El cliente implementa:

`GET /athletes/formation/positionAndNumber?athleteIds={ids separados por coma}`

Antes de llamar, el cliente deduplica IDs y filtra valores no finitos. La respuesta es un mapa por athleteId con, al menos, `shirtNumber` y `position`.

Importante: este endpoint recibe solamente athleteIds. No recibe teamId ni tournamentId. Por eso `shirtNumber` y `position` no quedan demostrados como atributos de una membresía histórica concreta.

### Guest onboarding legítimo

La app 1.1.3 implementa `POST /init-onboarding` sin body y con `skipAuth`. La respuesta aporta el access token que usa el cliente para las lecturas autenticadas posteriores.

En todas las pruebas runtime de esta investigación el token fue efímero, enmascarado en GitHub Actions y eliminado al terminar. No se guardaron tokens, cookies ni credenciales.

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

| tournamentId | torneo | temporada | división | rama | estado del torneo |
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

La ejecución manual de GitHub Actions fue además re-ejecutada y validada visualmente: `clubId=335`, `teamId=1843`, categoría 100, división 421, rama Masculino, `tournamentId=775`, 16 jugadores y 16 athleteIds únicos.

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

## Membresías múltiples dentro de Ferro 2026

Se hizo un recorrido runtime adicional, acotado únicamente a Ferro masculino y temporada 2026, usando el guest legítimo y llamadas GET.

Se paginó `GET /teams?club=335&gender=M`, se resolvieron los torneos 2026 de cada teamId y se consultó el roster exacto de cada combinación teamId+tournamentId.

Resultados:

| Medida | Resultado |
| --- | ---: |
| equipos masculinos de Ferro descubiertos | 20 |
| filas de membresía `(teamId,tournamentId,athleteId)` | 482 |
| athleteId únicos | 192 |
| athleteId en más de una membresía | 170 |
| athleteId en más de un teamId distinto | 80 |
| athleteId en más de una categoría etaria | 63 |
| athleteId en varios teamId dentro de una sola categoría | 17 |
| athleteId en dos teamId distintos dentro del mismo tournamentId | 0 |
| athleteId repetidos sólo entre torneos de un único teamId | 90 |

### Consecuencia de modelado

Está confirmado que `athleteId -> teamId` **no es 1:1**.

Un mismo atleta puede integrar varios planteles reales del mismo club durante una temporada, incluso:

- distintas categorías;
- distintos equipos de una misma categoría;
- Apertura y Clausura;
- una combinación de los anteriores.

Por ejemplo, `athleteId=16284` Juan Martín Bartolomeo aparece en:

- Mayores A `teamId=1843`, Apertura `775`;
- Mayores A `teamId=1843`, Clausura `1204`;
- Junior A `teamId=369`, Apertura `790`;
- Junior A `teamId=369`, Clausura `1213`.

Otro caso, `athleteId=10565` Tonko Simunovic Granero, aparece en dos `teamId` diferentes dentro de categoría Junior —`369` y `3715`— en distintos torneos, además de Mayores B `3256`.

Por lo tanto:

- `athleteId` identifica a la persona/deportista;
- `teamId` identifica un equipo;
- `tournamentId` aporta el contexto competitivo/temporal;
- la pertenencia deportiva debe materializarse como una entidad separada.

La temporada 2026 por sí sola tampoco alcanza para identificar un plantel.

No se observó, dentro de este alcance Ferro masculino 2026, un mismo athleteId en dos teamId distintos dentro del mismo tournamentId. Esto es evidencia de este scope, no una regla global de FEMEBAL.

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

- `GET /teams`: paginado con `count`, `limit`, `skip`, `items`; la prueba de Ferro recorrió todas las páginas.
- roster endpoint: respuesta array directa; no se observó envelope `count/limit/skip` ni parámetros de paginación en el método del cliente.
- Ferro 1843/775: 16 filas / 16 IDs únicos; sin duplicados.
- Ballester 3291/775: 25 filas / 25 IDs únicos; sin duplicados.
- Ferro vs Ballester en 775: 0 athleteIds compartidos en este par.
- Dentro de Ferro masculino 2026: 80 athleteIds estuvieron en más de un teamId; 63 cruzaron categoría; 17 estuvieron en varios teamId manteniendo una sola categoría.
- No se observaron casos en Ferro masculino 2026 de un athleteId en dos teamId dentro del mismo tournamentId.

## Modelo recomendado para Integración

Separar identidad de atleta, equipo/competencia y membresía.

### Athlete

Identidad estable del deportista:

- athleteId
- firstName
- lastName
- birthDate/picture sólo si el producto realmente los necesita

No guardar un único `clubId`, `teamId`, categoría o división como atributos permanentes de Athlete.

### RosterMembership

La pertenencia concreta debe tener como identidad lógica, como mínimo:

`(teamId, tournamentId, athleteId)`

Y conservar por join/proveniencia:

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

Una implementación relacional futura debería permitir múltiples RosterMembership para el mismo athleteId, incluso en la misma temporada.

No inferir automáticamente:

- `active=true` por aparecer;
- `baja=true` por desaparecer de otro torneo;
- fechas de alta/baja a partir de fechas del torneo;
- dorsal histórico a partir de `formation/positionAndNumber`.

## Estado de cada requisito

| Requisito | Estado |
| --- | --- |
| endpoint exacto roster | CONFIRMADO CÓDIGO + RUNTIME |
| parámetros teamId+tournamentId | CONFIRMADO CÓDIGO + RUNTIME |
| clubId -> teamId exacto | CONFIRMADO RUNTIME |
| teamId -> tournamentId exacto | CONFIRMADO CÓDIGO + RUNTIME |
| athleteId del plantel | CONFIRMADO CÓDIGO + RUNTIME |
| plantel completo Ferro | CONFIRMADO RUNTIME + VALIDACIÓN VISUAL |
| segundo club | CONFIRMADO RUNTIME |
| athleteId coincide con perfil individual | CONFIRMADO RUNTIME, 16/16 Ferro |
| paginación de equipos | CONFIRMADA RUNTIME (`count/limit/skip`) |
| paginación del roster | NO OBSERVADA; cliente no expone params de paginación |
| duplicados dentro de un roster | NO OBSERVADOS en 16/16 Ferro ni 25/25 Ballester |
| relación temporal por tournamentId | CONFIRMADA RUNTIME |
| mismo athleteId en varios teamId | CONFIRMADO RUNTIME: 80 casos en Ferro masculino 2026 |
| mismo athleteId en varias categorías | CONFIRMADO RUNTIME: 63 casos en Ferro masculino 2026 |
| mismo athleteId en varios teamId de una misma categoría | CONFIRMADO RUNTIME: 17 casos en Ferro masculino 2026 |
| mismo athleteId en varios teamId dentro del mismo tournamentId | NO OBSERVADO en Ferro masculino 2026; no generalizar |
| posición | CONFIRMADA como dato de formación; alcance temporal DE PLANTEL PENDIENTE |
| dorsal histórico de plantel | PENDIENTE; `shirtNumber` no está team/tournament-scoped |
| rol de membresía | PENDIENTE |
| activo/baja explícito | PENDIENTE |
| fecha alta/baja de membresía | PENDIENTE |
| ID propio de la relación de membresía | PENDIENTE / no observado en roster endpoint |

## Artefactos

- `data/femebal/discovery/rosters/ferro-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/sag-villa-ballester-mayores-lhc-apertura-2026.json`
- `data/femebal/discovery/rosters/ferro-2026-membership-diagnostic.json`
- `.github/workflows/femebal-roster-runtime-safe.yml` — reproducción mínima Ferro LHC Apertura 2026.
- `.github/workflows/femebal-roster-shared-athletes-safe.yml` — diagnóstico read-only de membresías múltiples Ferro 2026.
- `docs/femebal/rosters/runtime-one-click.md`

## Intervención

No se requiere intervención de Tomás para reproducir la cadena validada mientras el guest onboarding siga disponible con el contrato observado en 1.1.3.
