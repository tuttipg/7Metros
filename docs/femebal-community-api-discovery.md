# FEMEBAL Community API — estado de descubrimiento

Fecha de referencia: 2026-09-11.

## Objetivo

Documentar únicamente evidencia reproducible sobre la API usada por FEMEBAL Community y evitar inferencias de autenticación no verificadas.

## Base confirmada

- API base: `https://api.cam.larrysport.tecdata.net`
- Header de variante: `X-App-Variant: cah`
- User-Agent observado/usado por las sondas: `FemebalCommunity/1.0.13`

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

La existencia de endpoints públicos **no implica** que los partidos sean públicos. El siguiente paso válido es reconstruir el flujo de autenticación real que usa la app antes de intentar extraer `/matches`.

No está validado que Firebase Auth sea el proveedor de autenticación del backend de partidos. Un intento previo contra Firebase devolvió `CONFIGURATION_NOT_FOUND`; esa respuesta debe tratarse como evidencia negativa y no como una credencial o flujo válido.

## Guardrails

1. No volver a asumir que una API key de Firebase embebida en la app sirve para autenticar `/matches`.
2. No inventar contraseñas para cuentas guest observadas en strings del APK.
3. No enviar escrituras a Supabase durante la fase de descubrimiento.
4. No mezclar descubrimiento de rutas con importación de datos.
5. Clasificar cada respuesta como pública JSON, pública no JSON, protegida, inexistente o error antes de decidir el siguiente paso.
6. Mantener las pruebas de clasificación en CI.

## Código de referencia

- `n8n/community-api-core.mjs`
- `n8n/community-api-core-smoke.mjs`

El núcleo genera un plan mínimo de probes, normaliza respuestas y fuerza la decisión `reverse_engineer_app_auth_flow` cuando `/matches` devuelve 401/403.

## Pendiente que requiere nueva evidencia

Para avanzar sobre partidos hace falta obtener de forma verificable uno de estos elementos desde la app o su tráfico real:

- endpoint exacto de login/guest y método HTTP;
- payload exacto del login/guest;
- formato del token devuelto;
- header exacto usado en `/matches`;
- mecanismo de refresh si existe.

Hasta entonces, `/matches` debe considerarse protegido y no apto para importación automática.
