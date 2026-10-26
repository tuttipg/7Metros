# TournamentTracker — límite entre evidencia declarada y observación pública

Fecha: 2026-10-26

## Objetivo

Este documento fija una frontera explícita para el discovery SAFE de rutas públicas de TournamentTracker. Una estructura de evidencia válida demuestra que un registro **declara** una URL observada y que esa declaración cumple el contrato estático; no demuestra por sí sola que el modelo haya vuelto a consultar la fuente pública en tiempo de ejecución.

## Qué verifica el contrato estático

`n8n/tournamenttracker-indexed-route-core.mjs` valida, entre otras cosas:

- host oficial FEMEBAL para la ruta objetivo;
- HTTPS y ausencia de credenciales, fragmentos, query strings y puertos HTTPS no estándar;
- token único con formato restringido;
- rechazo de backslashes, controles y traversal/encoding ambiguo;
- fuente `public_index` limitada a Google/Bing y con consulta que referencia FEMEBAL + TournamentTracker;
- fuente `explicit_public_link` limitada a FEMEBAL y distinta de la propia ruta objetivo;
- correspondencia exacta entre la URL objetivo y el `resultUrl`/`linkedUrl` declarado.

La salida SAFE sigue siendo `GET` anónimo, sin `Authorization`, sin cookies, sin escrituras y con `automaticProbeAllowed=false`.

## Qué NO verifica

El contrato estático **no convierte una declaración de evidencia en una observación independiente**. En particular, una prueba unitaria puede proporcionar un `sourceUrl`, `resultUrl` o `linkedUrl` que satisfaga el esquema sin demostrar que ese enlace fue efectivamente observado en una página pública durante el run actual.

Por eso, los fixtures de smoke no deben tratarse como evidencia histórica del descubrimiento del partido control. Son regresiones del contrato de seguridad.

Para afirmar que una ruta TournamentTracker fue realmente descubierta públicamente, la evidencia debe conservar además un registro reproducible de la fuente observada (por ejemplo, URL pública y captura/artefacto verificable cuando corresponda), y debe poder vincularse al partido/torneo correcto sin inferir el token.

## Partido control

Referencia de validación: **Argentinos Juniors 20–27 Ferro Carril Oeste, 21/03/2026, Liga de Honor Caballeros, 20:15**.

La existencia del fixture y el marcador pueden corroborarse mediante fuentes públicas independientes, pero eso no basta para afirmar que una ruta TournamentTracker concreta o un PDF concreto fueron descubiertos públicamente.

La planilla conocida `5ce377051ea0acb1.pdf` debe seguir tratándose como **artefacto de regresión conocido** hasta disponer de evidencia pública independiente que establezca su procedencia.

## Regla operativa

No promover una ruta a `publicly_discovered=true` ni autorizar un GET real sólo porque un fixture estático o una prueba sintética contiene un `linkedUrl` que coincide con la ruta. La transición requiere evidencia pública observada y trazable.
