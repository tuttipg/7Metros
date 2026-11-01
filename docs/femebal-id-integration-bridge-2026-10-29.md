# FEMEBAL — bridge de integración por IDs oficiales (2026-10-29)

## Objetivo

Unir de forma reproducible, SAFE y DRY RUN:

`torneo → partido → planilla → participantes → estadísticas`

sin usar nombres como clave primaria, sin descubrir endpoints nuevos, sin importar masivamente y sin escribir en Supabase/producción.

## Estado real coordinado

### Confirmado dentro del repositorio / CI

- El partido control es **Argentinos Juniors 20–27 Ferro Carril Oeste**, 21/03/2026, 20:15, Mayores, LHC Hipotecario Seguros.
- La programación oficial pública confirma fecha/hora/scope; TournamentTracker indexado corrobora el 20–27.
- La URL histórica conocida de la planilla de control es:
  `https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf`.
- El parser de planilla valida 16 jugadores por lado, 20–27 por suma individual y sanciones explícitas.
- `planilla-dry-run-core.mjs` exige identidad completa antes de marcar `expected_match_checked=true`.
- `player-scope-core.mjs` resuelve planteles locales por scope exacto y falla cerrado ante ambigüedad.
- El contrato estático 1.1.3 documenta IDs `athleteId`, `teamId`, `clubId`, `tournamentId` y, entre otros recursos, `/athletes/topScorers/{matchId}`.

### Confirmado por los frentes especializados del proyecto, pero aún no incorporado como artefacto reproducible del repo

La coordinación de Jugadores/Planteles registró runtime legítimo para Ferro:

- `clubId = 335`
- `teamId = 1843`
- Apertura 2026: `tournamentId = 775`
- `GET /athletes/athletesByTeam/1843?tournamentId=775` → 16 atletas / 16 `athleteId` únicos
- perfiles individuales usados para contrastar la identidad de esos atletas.

Esta evidencia se usa para orientar la integración del proyecto, pero **no se transforma aquí en fixture de CI con IDs reales** porque el repositorio no contiene todavía la captura runtime sanitizada que permita reproducirla de forma independiente.

El smoke nuevo usa IDs sintéticos deliberadamente: valida el contrato técnico, no pretende convertir evidencia conversacional en evidencia de repositorio.

## Hueco canónico actual

Todavía falta evidencia original reproducible para cerrar:

- `tournamentId 775 → matchId` del control AAAJ–Ferro;
- `matchId → matchSheetId`, si existe como ID separado;
- IDs originales del equipo de Argentinos en ese partido;
- participantes del partido identificados directamente por `athleteId` desde un recurso de partido o mapping externo explícito y auditable.

Por eso **no existe todavía una participación canónica del control** con clave `(matchId, athleteId)`.

La planilla prueba participación documental y estadísticas, pero no crea por sí sola un `matchId` ni un `athleteId`.

## Mejora implementada

Se agregó:

- `n8n/femebal-integration-core.mjs`
- `n8n/femebal-integration-core-smoke.mjs`

El núcleo recibe únicamente datos ya resueltos por otros frentes:

- `clubId`
- `teamId`
- `tournamentId`
- `matchId` opcional
- `matchSheetId` opcional
- roster de `athleteId`
- planilla ya parseada
- mapping explícito `dorsal de esa planilla → athleteId` con provenance

### Regla de identidad

Los nombres son sólo un cross-check de presentación.

El núcleo declara:

`name_join_used=false`

y no busca atletas por nombre/apellido.

La fila de la planilla se localiza por `side + dorsal`; el `athleteId` debe venir explícitamente de un mapping externo y además pertenecer al roster esperado.

### Gate de matchId

Si `matchId` falta:

- estado: `pending_match_id`;
- se conservan participantes resueltos y estadísticas en DRY RUN;
- `canonical_participations=[]`.

Si `matchId` existe y pasa validación:

- estado: `canonical_match_ready`;
- se generan participaciones DRY RUN con clave lógica `(matchId, athleteId)`;
- cada fila conserva `teamId`, `tournamentId`, `matchSheetId` si está disponible, dorsal usado, goles y sanciones.

Esto evita que una planilla documental sea promovida accidentalmente a una participación canónica antes de resolver el partido por ID oficial.

## Fallos cerrados cubiertos

El smoke rechaza:

- `athleteId` fuera del roster;
- mappings incompletos;
- `athleteId` duplicado;
- team name de cross-check inconsistente;
- `matchId` malformado.

También verifica que el ejemplo de Ferro suma 27 goles y 2 exclusiones del lado visitante, sin producir escrituras.

## Siguiente gate reproducible

El siguiente avance de integración no requiere más hardening de URLs ni más discovery general.

Se necesita uno de estos hallazgos de los frentes Partidos/Resultados:

1. un `matchId` original para el partido control, ligado a `tournamentId=775` y a los team IDs originales; o
2. un artefacto runtime sanitizado equivalente que permita verificar esa relación offline.

Cuando llegue ese dato, debe pasarse al bridge; no se debe inferir desde fecha, nombres, marcador, URL PDF ni IDs locales de 7Metros.

## Seguridad

- DRY RUN únicamente;
- sin red en el nuevo core;
- sin `Authorization`, cookies ni tokens;
- sin escritura en Supabase;
- sin importación masiva;
- sin cambios de producción;
- sin joins primarios por nombre.
