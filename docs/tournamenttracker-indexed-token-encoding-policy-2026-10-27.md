# TournamentTracker — política de encoding del token opaco (2026-10-27)

## Hallazgo

La canonicalización de rutas indexadas decodificaba el segmento completo del token antes de validarlo. Eso permitía que spellings como `%41` o `%2D` representaran caracteres del token sin codificar. Aunque el token resultante cumpliera el allowlist, el spelling raw era distinto y podía canonicalizarse a la misma ruta objetivo. La evidencia estructurada compara rutas canonicalizadas, por lo que no conviene aceptar esas variantes sin necesidad.

## Corrección

`n8n/tournamenttracker-indexed-route-core.mjs` ahora admite:

- caracteres del token permitidos sin encoding;
- padding literal `=` (hasta dos caracteres);
- padding final codificado como `%3D` (incluida la variante hexadecimal `%3d`).

Rechaza percent-encoding de caracteres del token, doble encoding y mezclas de padding literal/codificado. Se conserva `%3D` porque la URL oficial del fixture LHC observada públicamente utiliza ese spelling para el padding final.

## Regresión

`n8n/tournamenttracker-indexed-route-core-smoke.mjs` comprueba que:

- la ruta oficial con `%3D` y su forma canonicalizada continúan aceptándose;
- `%3d` también representa el mismo byte de padding y se acepta;
- variantes con `%41`, `%2D`, `%5F` y doble encoding se rechazan.

Estas pruebas son estáticas y locales al smoke; no ejecutan solicitudes HTTP, no enumeran rutas ni habilitan probes.

## Límites SAFE

- `automaticProbeAllowed=false`.
- GET anónimo sólo como plan revisable; no se ejecuta automáticamente.
- Sin credenciales, cookies ni `Authorization`.
- Sin escrituras de Supabase o producción.

La corrección reduce alias de representación del token. No demuestra que una ruta indexada corresponda a un partido o planilla concreta; esa relación sigue requiriendo evidencia pública explícita y revisión manual.
