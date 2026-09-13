# FEMEBAL Community API — estado de descubrimiento

Fecha de referencia: 2026-09-12.

## Objetivo

Documentar únicamente evidencia reproducible sobre la API usada por FEMEBAL Community y limitar el análisis a superficies públicas, GET-only y sin autenticación. No se usan ni se investigan credenciales, tokens, cookies, headers `Authorization` ni secretos.

## Base confirmada

- API base: `https://api.cam.larrysport.tecdata.net`
- Header de variante: `X-App-Variant: cah`
- User-Agent usado por las sondas existentes: `FemebalCommunity/1.0.13`

## Evidencia reproducida en n8n

Se observaron respuestas JSON públicas para rutas de referencia como:

- `/teams/categories`
- `/news/list`

La respuesta de categorías incluye categorías oficiales como Mini, Infantiles, Menores, Cadetes, Juveniles, Junior y Mayores.

En cambio, las variantes probadas de `/matches` devolvieron:

```json
{"error":"Unauthorized","message":"Missing authorization header"}
```

con HTTP 401.

También se comprobaron rutas inexistentes que responden 404, por ejemplo `/top-scorers`, `/standings` y `/stats` en la raíz.

## Conclusión actual

La existencia de endpoints públicos **no implica** que los partidos sean públicos. Una ruta que responda 401/403 se considera protegida y queda fuera de alcance para este pipeline. No se intenta descubrir, reconstruir ni reproducir autenticación para acceder a ella.

El siguiente paso permitido es continuar únicamente con discovery de rutas públicas y con las fuentes oficiales FEMEBAL que ya son accesibles sin autenticación. Si en el futuro `/matches` u otra fuente equivalente se publica legítimamente sin auth, deberá volver a validarse desde cero antes de consumirla.

No está validado que Firebase Auth sea el proveedor de autenticación del backend de partidos. Un intento previo contra Firebase devolvió `CONFIGURATION_NOT_FOUND`; esa respuesta se conserva solo como evidencia negativa y no habilita nuevas pruebas de autenticación.

## Guardrails

1. No investigar, solicitar ni reutilizar credenciales, tokens, cookies, `Authorization` ni secretos.
2. Tratar cualquier 401/403 como un límite de alcance: registrar la ruta protegida y continuar por superficies públicas.
3. No inventar contraseñas ni intentar cuentas guest observadas en artefactos de aplicaciones.
4. No enviar escrituras a Supabase durante la fase de descubrimiento.
5. No mezclar descubrimiento de rutas con importación de datos.
6. Clasificar cada respuesta como pública JSON, pública no JSON, protegida, inexistente o error antes de decidir el siguiente paso.
7. Mantener las pruebas de clasificación y de fail-closed en CI.

## Código de referencia

- `n8n/community-api-core.mjs`
- `n8n/community-api-core-smoke.mjs`

El núcleo genera un plan mínimo de probes GET-only, normaliza respuestas y, cuando detecta una ruta protegida, devuelve `skip_protected_matches_expand_public_routes` o `skip_protected_routes_expand_public_routes`. También expone `authDiscoveryEnabled=false` y la lista `protectedRoutesOutOfScope` para impedir que un consumidor convierta por accidente un 401/403 en una tarea de autenticación.

Los smoke tests comprueban además que el plan no incluya headers `Authorization` ni `Cookie`.

## Pendiente que no requiere autenticación

- ampliar de forma conservadora el inventario de rutas públicas ya expuestas por la plataforma;
- comparar cualquier nueva fuente pública contra datos oficiales FEMEBAL cuando exista un partido control apropiado;
- documentar TournamentTracker únicamente si se identifica una superficie FEMEBAL pública y reproducible;
- mantener `/matches` y cualquier otra ruta 401/403 fuera de importación automática.
