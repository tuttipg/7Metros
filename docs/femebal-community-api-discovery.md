# FEMEBAL Community API — estado de descubrimiento

Fecha de referencia: 2026-09-13.

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

## TournamentTracker público de FEMEBAL

La web oficial de FEMEBAL enlaza desde `Torneos & Fixtures` a la superficie pública:

`https://www.femebal.com/tournament-tracker/?noAdv=0`

La respuesta pública observada es el shell de una SPA y, sin ejecutar JavaScript, expone el mensaje `You need to enable JavaScript to run this app.`. Esto confirma una superficie pública reproducible de TournamentTracker alojada bajo el dominio oficial de FEMEBAL, pero **no confirma todavía ningún endpoint de datos**.

Se agregó `n8n/tournamenttracker-public-core.mjs` para modelar esta superficie de forma fail-closed. El núcleo:

- permite sólo HTTPS y los hosts `femebal.com` / `www.femebal.com`;
- restringe la ruta a `/tournament-tracker/`;
- admite únicamente el parámetro público observado `noAdv` con valores `0` o `1`;
- rechaza credenciales embebidas, fragments, hosts externos y query params desconocidos;
- genera únicamente un probe `GET` sin cookies ni `Authorization`;
- clasifica 401/403 como superficie protegida y detiene la expansión;
- cuando reconoce el shell público, limita el siguiente paso a análisis estático de assets públicos.

El smoke test asociado (`n8n/tournamenttracker-public-core-smoke.mjs`) cubre canonicalización, redirects externos, URLs inseguras, ausencia de headers sensibles y la clasificación del shell SPA.

No se afirma que los assets estáticos ni sus endpoints internos estén validados todavía. Cualquier endpoint descubierto a partir del bundle deberá tratarse como candidato hasta comprobar que responde públicamente, por GET y sin autenticación.

## Evidencia oficial adicional útil para validación

El documento oficial `Sistema de Competencia Liga de Honor Hipotecario Seguros 2026` confirma que Apertura y Clausura son torneos todos-contra-todos y lista 16 equipos inscriptos por rama. Entre los caballeros aparecen `ARGENTINOS JRS A` y `FERRO CARRIL OESTE A`, lo que aporta una segunda fuente oficial para validar aliases de equipos del partido control, sin sustituir la programación ni la planilla individual.

## Conclusión actual

La existencia de endpoints públicos **no implica** que los partidos sean públicos. Una ruta que responda 401/403 se considera protegida y queda fuera de alcance para este pipeline. No se intenta descubrir, reconstruir ni reproducir autenticación para acceder a ella.

El siguiente paso permitido es continuar únicamente con discovery de rutas públicas, análisis estático de assets públicos de TournamentTracker y las fuentes oficiales FEMEBAL que ya son accesibles sin autenticación. Si en el futuro `/matches` u otra fuente equivalente se publica legítimamente sin auth, deberá volver a validarse desde cero antes de consumirla.

No está validado que Firebase Auth sea el proveedor de autenticación del backend de partidos. Un intento previo contra Firebase devolvió `CONFIGURATION_NOT_FOUND`; esa respuesta se conserva solo como evidencia negativa y no habilita nuevas pruebas de autenticación.

## Guardrails

1. No investigar, solicitar ni reutilizar credenciales, tokens, cookies, `Authorization` ni secretos.
2. Tratar cualquier 401/403 como un límite de alcance: registrar la ruta protegida y continuar por superficies públicas.
3. No inventar contraseñas ni intentar cuentas guest observadas en artefactos de aplicaciones.
4. No enviar escrituras a Supabase durante la fase de descubrimiento.
5. No mezclar descubrimiento de rutas con importación de datos.
6. Clasificar cada respuesta como pública JSON, pública no JSON, protegida, inexistente o error antes de decidir el siguiente paso.
7. Mantener las pruebas de clasificación y de fail-closed en CI.
8. Para TournamentTracker, no avanzar de un shell público a endpoints internos sin verificar individualmente que cada ruta sea pública, GET-only y sin autenticación.

## Código de referencia

- `n8n/community-api-core.mjs`
- `n8n/community-api-core-smoke.mjs`
- `n8n/tournamenttracker-public-core.mjs`
- `n8n/tournamenttracker-public-core-smoke.mjs`

El núcleo de Community genera un plan mínimo de probes GET-only, normaliza respuestas y, cuando detecta una ruta protegida, devuelve `skip_protected_matches_expand_public_routes` o `skip_protected_routes_expand_public_routes`. También expone `authDiscoveryEnabled=false` y la lista `protectedRoutesOutOfScope` para impedir que un consumidor convierta por accidente un 401/403 en una tarea de autenticación.

Los smoke tests comprueban además que los planes no incluyan headers `Authorization` ni `Cookie`.

## Pendiente que no requiere autenticación

- analizar estáticamente los assets públicos cargados por el shell oficial de TournamentTracker;
- ampliar de forma conservadora el inventario de rutas públicas ya expuestas por la plataforma;
- comparar cualquier nueva fuente pública contra datos oficiales FEMEBAL cuando exista un partido control apropiado;
- intentar validar el partido control Argentinos Juniors 20–27 Ferro del 21/03/2026 contra cualquier fuente pública nueva antes de incorporarla;
- mantener `/matches` y cualquier otra ruta 401/403 fuera de importación automática.
