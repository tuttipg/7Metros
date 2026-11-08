# TournamentTracker SAFE — auditoría de escapes porcentuales malformados

Fecha: 2026-10-29

## Hallazgo

La política estática de endpoints rechazaba escapes porcentuales válidos en el path mediante una expresión que sólo detectaba `%HH`. El parser WHATWG de Node conserva literalmente secuencias malformadas como `%ZZ`, `%` y `%2G`; por tanto, esas grafías podían superar esa comprobación específica y seguir a las demás reglas de clasificación.

No se demostró que un endpoint de FEMEBAL interprete esas rutas de forma especial. El defecto es una inconsistencia preventiva: la política declara que los paths con percent-encoding no están permitidos, pero la implementación sólo cubría escapes con dos dígitos hexadecimales.

## Cambio

`n8n/tournamenttracker-static-endpoint-core.mjs` ahora rechaza cualquier signo `%` presente en el `pathname` normalizado. Esto mantiene la política fail-closed y la alinea con el descubridor Python, que rechaza cualquier `%` en el path raw. No se modifica la política de query-string.

## Regresión

`n8n/tournamenttracker-query-policy-smoke.mjs` incluye tres casos negativos:

- `/api/%ZZ`
- `/api/%`
- `/api/%2G`

Cada caso debe terminar en `rejected_on_policy_revalidation`, con motivo `percent_encoded_path_not_allowed`, sin revisión GET ni probing.

## Límites de seguridad

- Prueba estática/offline; no se consulta ninguna de estas rutas en FEMEBAL.
- No se ejecuta JavaScript remoto.
- No se usan credenciales, cookies, tokens ni encabezados `Authorization`.
- `probeAllowed=false`; no se habilitan escrituras en Supabase ni en producción.
- Los filtros de query no se alteran.

## Validación pendiente

Los cambios están en la rama `automation/femebal-public-discovery-safe-v3`. La validación definitiva queda a cargo de los workflows de GitHub Actions disparados por el PR; no se declara CI verde hasta observar sus resultados.
