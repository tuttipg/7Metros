# Gate SAFE: programación vs. planilla de partido — 2026-10-29

## Hallazgo

La política genérica `canonicalizeOfficialFemebalUrl(url, { pdf: true })` permite dos árboles oficiales con propósitos distintos:

- `https://femebal.com/wp-content/uploads/...`: PDFs publicados por WordPress, incluidos archivos de programación.
- `https://djfhz848yeeat.cloudfront.net/pdf_planillas/...`: planillas de partido observadas.

Antes de esta corrección, los validadores de work items comprobaban que el campo `document_type` dijera `planilla_partido_pdf`, pero no verificaban que la URL perteneciera al árbol de planillas. Un work item podía etiquetar una programación PDF como planilla y superar la validación de URL.

Esto es un defecto de clasificación en el contrato local; no implica que un endpoint remoto haya sido explotado.

## Corrección

Se agregó `canonicalizeOfficialFemebalPlanillaUrl`, que reutiliza las restricciones HTTPS/host/path/PDF de la política común y además exige el host de planillas y el prefijo exacto `/pdf_planillas/`.

El helper se usa ahora en:
- `n8n/planilla-dry-run-core.mjs`, para URL y provenance de ambas variantes de work item.
- `n8n/tournamenttracker-pdf-work-item-core.mjs`, para el PDF seleccionado y el PDF enlazado al partido.

Los PDFs de programación siguen siendo válidos como recursos de programación en el descubridor; simplemente no pueden usarse como planillas estadísticas.

## Regresiones

- El smoke de `planilla-dry-run-core` intenta presentar `/wp-content/uploads/2026/03/Sabado-21-3.pdf` como `planilla_partido_pdf` y exige rechazo.
- El smoke de TournamentTracker intenta seleccionar esa misma programación como la única planilla de un partido y exige rechazo.
- Los fixtures positivos continúan usando la planilla conocida del partido control: Argentinos Juniors 20–27 Ferro Carril Oeste, 2026-03-21 20:15, Mayores, LHC Hipotecario Seguros.

## Límites de seguridad

- No se descargó ningún PDF real en esta corrección.
- No se infirió ni enumeró ningún identificador.
- No se ejecutó JavaScript remoto.
- No se usaron credenciales, cookies, tokens ni encabezados `Authorization`.
- No se habilitaron escrituras en Supabase ni producción.
- La planilla del partido de control sigue siendo un fixture conocido; esta corrección no prueba que haya sido descubierta mediante un enlace público real.

## Verificación

Los smokes se ejecutan en CI mediante los workflows SAFE existentes. El resultado debe evaluarse sobre el HEAD final de la rama, no sobre commits intermedios.
