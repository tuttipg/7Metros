# Auditoría SAFE: claves de query con tokens sensibles embebidos — 2026-10-28

## Hallazgo

La política anterior rechazaba nombres de parámetros sensibles cuando el token aparecía al inicio o al final del nombre normalizado. Eso dejaba pasar variantes con prefijo y sufijo arbitrarios, por ejemplo `prefixAccessTokenSuffix` o `prefixClientSecretSuffix`, aunque el nombre contuviera un marcador inequívoco de material de autenticación.

La brecha existía en ambos lados del contrato: el discovery Python (`tools/femebal_public_discovery.py`) y la política Node de TournamentTracker (`n8n/tournamenttracker-static-endpoint-core.mjs`).

## Corrección

- Python y Node ahora rechazan una clave normalizada si contiene cualquiera de los tokens sensibles compuestos conocidos.
- Se mantiene `key` como coincidencia exacta sensible, no como token compuesto genérico; por eso filtros ordinarios como `sortKey=date` siguen permitidos.
- La regla sólo clasifica candidatos: no habilita probes, autenticación ni escrituras. El contrato sigue siendo SAFE/DRY RUN y toda URL candidata continúa requiriendo revisión manual.

## Regresiones

Se agregaron casos para tokens embebidos de access token, client secret, private key y session token en:
- `tests/test_femebal_sensitive_query.py`
- `n8n/tournamenttracker-static-endpoint-core-smoke.mjs`

La suite Python ya está incluida en `.github/workflows/validate.yml`; el smoke Node forma parte de la matriz SAFE aislada y de Validate.

## Validación

El commit que incorpora las pruebas disparó Validate 7Metros, FEMEBAL SAFE smoke isolation, TournamentTracker PDF work-item SAFE regression y PDF extraction provenance SAFE regression. Los resultados se registrarán cuando las cuatro ejecuciones finalicen.

No se hicieron llamadas a endpoints de la aplicación, no se usaron secretos y no se modificó Supabase ni producción.
