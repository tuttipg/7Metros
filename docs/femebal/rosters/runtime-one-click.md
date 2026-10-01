# Prueba runtime de plantel — un clic

Objetivo: validar en vivo el plantel real de Ferro Carril Oeste, Mayores A, LHC Hipotecario Seguros, Masculino, Torneo Metropolitano Apertura 2026, usando exclusivamente el guest legítimo de LarrySport/FEMEBAL Community 1.1.3.

## Alcance fijo de la prueba

- clubId: `335` — Ferro Carril Oeste
- teamId: `1843` — Mayores A
- categoryId: `100` — Mayores
- divisionId: `421` — LHC Hipotecario Seguros
- rama: Masculino
- tournamentId: `775` — Torneo Metropolitano Apertura 2026
- roster endpoint: `GET /athletes/athletesByTeam/1843?tournamentId=775`

## Seguridad

La Action sólo realiza:

1. `POST /init-onboarding` — flujo guest legítimo observado en la app 1.1.3.
2. `GET /teams?...` — comprueba que `teamId=1843` siga siendo Ferro/Mayores/LHC/Masculino.
3. `GET /teams/1843/tournaments` — comprueba que `tournamentId=775` siga siendo Apertura 2026.
4. `GET /athletes/athletesByTeam/1843?tournamentId=775` — obtiene el plantel.

No consulta ni modifica Supabase. No realiza escrituras de producción. El Bearer guest sólo vive en memoria durante la ejecución, se enmascara en logs y no se guarda como artifact, secret ni archivo del repositorio.

## Qué valida automáticamente

La ejecución falla si:

- el guest onboarding deja de responder correctamente;
- `teamId=1843` deja de resolver a Ferro Carril Oeste / Mayores / LHC / Masculino;
- `tournamentId=775` deja de resolver a Apertura 2026 en ese contexto;
- el roster no es un array JSON no vacío;
- hay `athleteId` duplicados;
- faltan `id`, `firstName` o `lastName`;
- desaparecen los anchors previamente confirmados Schankula (`19480`), Unzner (`19483`) o Ceccardi (`28365`).

Si pasa, el resumen de GitHub Actions muestra club, equipo, torneo, cantidad de jugadores, cantidad de IDs únicos y una tabla completa `athleteId -> nombre`.

## Un solo clic para repetirla

La Action se llama:

`FEMEBAL roster runtime — Ferro LHC Apertura 2026`

La rama de investigación es:

`research/femebal-rosters-1.1.3`

La forma más directa sin tocar código es abrir la última ejecución correcta de esa Action y pulsar **Re-run all jobs**. Eso vuelve a ejecutar exactamente la prueba SAFE contra el runtime actual.

El workflow también conserva `workflow_dispatch` para cuando esté disponible desde la interfaz de GitHub según la rama/default branch del repositorio.

## Resultado esperado conocido

La evidencia confirmada el 2026-10-01 devolvió:

- 16 filas de roster;
- 16 athleteIds únicos;
- coincidencia con el plantel Ferro Apertura 2026 ya documentado en `data/femebal/discovery/rosters/ferro-mayores-lhc-apertura-2026.json`.

La prueba no fuerza `count == 16`: si FEMEBAL corrige retrospectivamente el plantel, muestra el nuevo conjunto siempre que siga siendo estructuralmente válido y conserve los anchors de control. Esto permite detectar cambios sin confundir un ajuste oficial con un error técnico.
