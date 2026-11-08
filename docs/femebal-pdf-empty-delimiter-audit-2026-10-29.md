# Auditoría SAFE: delimitadores raw vacíos en URLs de planillas PDF (2026-10-29)

## Hallazgo

La validación de páginas HTML oficiales ya rechaza los delimitadores raw `?` sin query efectiva y cualquier `#` literal. La validación de PDF oficiales, en cambio, sólo comprobaba `urlparse(url).query` y `fragment`. Python normaliza `https://…/archivo.pdf?` y `https://…/archivo.pdf#` como query/fragment vacíos; ambas variantes podían pasar el control de tipo documental si la ruta y el host estaban permitidos.

## Cambio

`_document_type_for_official_pdf()` ahora inspecciona el spelling raw antes de aceptar el PDF:
- rechaza cualquier `#` literal;
- rechaza `?` cuando `urlparse()` no encuentra una query efectiva;
- conserva el rechazo existente de queries o fragmentos no vacíos.

La comprobación ocurre antes de clasificar el PDF como `programacion_pdf` o `planilla_partido_pdf`. No amplía hosts, rutas permitidas ni la allowlist.

## Regresión

`tests/test_femebal_public_discovery.py` agrega variantes negativas para la planilla de control conocida:
- `…5ce377051ea0acb1.pdf?`
- `…5ce377051ea0acb1.pdf#`
- `…5ce377051ea0acb1.pdf?#`

Las pruebas existentes también conservan casos para queries/fragmentos no vacíos, hosts no permitidos y rutas fuera del directorio `/pdf_planillas/`.

## Alcance y seguridad

Esto es una corrección del canonicalizador, no un descubrimiento nuevo de la planilla del partido Argentinos Juniors 20–27 Ferro del 21/03/2026. La URL usada por las pruebas sigue siendo un fixture conocido y no demuestra por sí sola un enlace público observado en una página oficial real.

No se realizaron escrituras en Supabase, llamadas autenticadas, enumeración de IDs ni probes de endpoints. La validación dinámica de la suite completa queda a cargo de CI tras estos commits; no se afirma una ejecución local en este entorno.
