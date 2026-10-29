# Auditoría de paridad de query sensible — TournamentTracker indexado (2026-10-29)

## Hallazgo

La política compartida `n8n/official-url-policy.mjs` rechaza nombres compuestos de autenticación como `authValue` y `authenticationMethod`, preservando filtros legítimos `author` y `authorId`.

La política independiente de evidencia pública en `n8n/tournamenttracker-indexed-route-core.mjs` ya bloqueaba `auth` exacto y varios compuestos (por ejemplo `authToken`), pero no incluía el token compuesto genérico `auth`. Eso creaba una asimetría: una URL fuente de evidencia indexada con `authValue=...` podía pasar una validación que la política común rechaza.

No se ha demostrado vulnerabilidad en FEMEBAL ni se ha realizado ninguna petición a ese tipo de URL; es una inconsistencia local verificable entre validadores.

## Corrección

- Se agregó `auth` a la lista de tokens sensibles compuestos.
- La coincidencia excluye nombres que comienzan con `author`, para evitar falsos positivos en `author` y `authorId`. Nombres como `authorToken` siguen bloqueados por el token `token`.
- Se agregaron regresiones negativas para `authValue`, `authenticationMethod`, `authorizationToken` y una clave sensible percent-encoded (`api%4BeyValue`).
- Se agregaron regresiones positivas para `author` y `authorId` en una fuente oficial explícita.
- Los resultados siguen siendo sólo GET anónimo revisable: `auth=false`, `writes=false`, `automaticProbeAllowed=false`. No se ejecuta ningún probe automáticamente.

## Validación

La suite está incluida en `.github/workflows/femebal-safe-smokes.yml` mediante el smoke existente `n8n/tournamenttracker-indexed-route-core-smoke.mjs`. El resultado definitivo debe confirmarse en GitHub Actions sobre el HEAD que contiene el código, los tests y esta documentación.

## Evidencia pública y límites

La ruta pública oficial de TournamentTracker está indexada por buscadores, y el contenido indexado corrobora el partido control Argentinos Juniors 20–27 Ferro del 21/03/2026 a las 20:15. La programación oficial confirma fecha, hora y equipos, pero no enlaza por sí misma la planilla final.

- Programación oficial: https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf
- Página oficial indexada de TournamentTracker: https://www.femebal.com/tournament-tracker/RUdVX3VheVA%3D

La ruta es evidencia de una página pública de competición, no evidencia de un PDF de planilla. No se infiere ni enumera ninguna ruta de `pdf_planillas`.

## Seguridad

- Sin credenciales, cookies, tokens de sesión ni encabezados `Authorization`.
- Sin ejecución de JavaScript remoto ni probing automático.
- Sin escrituras en Supabase o producción.
- PR #34 permanece Draft y sin merge.
