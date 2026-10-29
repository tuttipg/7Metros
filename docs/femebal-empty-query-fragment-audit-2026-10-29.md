# Auditoría de delimitadores raw vacíos en URLs FEMEBAL — 2026-10-29

## Hallazgo

La canonicalización Python de páginas FEMEBAL (tools/femebal_public_discovery.py) rechazaba fragments no vacíos y query strings sensibles/tracking, pero urllib.parse.urlparse() expone un delimitador final vacío como query == "" o fragment == "". Por eso, URLs con un ? final o un # final podían pasar la validación, a diferencia de la política ya aplicada al clasificador de rutas TournamentTracker en Node.js.

Ejemplos ahora rechazados:
- https://femebal.com/programaciones/?
- https://femebal.com/programaciones/#
- https://femebal.com/programaciones/?fase=apertura#

Las queries no vacías que superan la política existente siguen siendo válidas; la corrección no bloquea filtros ordinarios de lectura.

## Cambio

- Rechazar cualquier delimitador raw de fragmento (#), incluso si el fragmento está vacío.
- Rechazar un delimitador raw de query (?) cuando urlparse no expone un valor de query.
- Agregar regresiones offline a tests/test_femebal_public_discovery.py.
- Mantener el manejo original de conflictos de proveniencia del manifiesto y el guard __main__; el diff final no cambia ese contrato.

## Validación

En el commit de pruebas 732927f4f215e7f54f9dadf90cc97cbc2d8837f0:
- Validate 7Metros: éxito; incluye sintaxis Python y FEMEBAL public discovery unit tests.
- FEMEBAL SAFE smoke isolation: todos los jobs devueltos terminaron en éxito.
- TournamentTracker PDF work-item SAFE regression: éxito.
- TournamentTracker PDF extraction provenance SAFE regression: éxito.

El intento de ejecutar la suite desde el entorno local no pudo clonar el repositorio porque el DNS de GitHub no estaba disponible. La validación ejecutable se completó mediante GitHub Actions; no se afirma una ejecución local de los tests.

## Límites de seguridad

- Sólo validación estática y tests offline; sin llamadas nuevas a FEMEBAL.
- Sin autenticación, cookies, tokens ni encabezados Authorization.
- Sin probing automático de rutas TournamentTracker.
- Sin escrituras en Supabase ni cambios de producción.
- La planilla pública del partido control Argentinos Juniors 20–27 Ferro (21/03/2026) sigue sin enlace oficial verificable; esta corrección no altera ese estado.