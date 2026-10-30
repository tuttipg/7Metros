# TournamentTracker raw URL whitespace policy — 2026-10-27

## Hallazgo

La validación raw de `n8n/tournamenttracker-indexed-route-core.mjs` rechazaba backslashes y controles ASCII antes de construir un objeto `URL`, pero no rechazaba espacios en blanco ordinarios. El parser WHATWG puede recortar whitespace al inicio/final y normalizar otros casos, por lo que la cadena validada no siempre representaba literalmente el input recibido.

## Corrección

`rejectAmbiguousRawUrl` ahora rechaza cualquier whitespace raw (`/\\s/`) además de backslashes y controles ASCII/DEL, antes de `new URL()`. Las URLs que necesiten representar espacios deben codificarlos explícitamente, por ejemplo como `%20`; las rutas de TournamentTracker esperadas no necesitan espacios.

Se agregaron regresiones para:
- whitespace inicial/final en una URL TournamentTracker;
- whitespace sin codificar dentro de una ruta;
- whitespace raw dentro de la URL de fuente de evidencia de búsqueda.

La política sigue siendo fail-closed: no hace solicitudes de red, no habilita probes automáticos y no permite autenticación ni escrituras.

## Validación pendiente

El commit debe pasar los workflows SAFE/CI antes de considerar cerrada la corrección. Supabase y producción no se modifican.
