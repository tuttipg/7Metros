# FEMEBAL public discovery — SAFE

Descubridor GET-only para programaciones públicas oficiales de FEMEBAL. No usa LarrySport, login, cookies, tokens ni Supabase.

## Política
- allowlist estricta: `https://femebal.com` / `https://www.femebal.com`;
- solo GET;
- detecta páginas del Torneo Metropolitano y reprogramaciones;
- descubre únicamente adjuntos PDF publicados por FEMEBAL;
- produce manifiesto con `write_enabled=false` y `auth_used=false`;
- no interpreta un PDF como resultado final: una programación prueba fixture/fecha/hora, no marcador.

## Contrato con el importador
El núcleo `n8n/importer-core.mjs` valida el manifiesto antes de que una etapa posterior pueda consumirlo. El gate falla cerrado salvo que se cumplan simultáneamente:

- `schema_version === 2`;
- `safe === true`;
- `complete === true`;
- `write_enabled === false`;
- `auth_used === false`;
- `pages`, `pdfs` y `fetch_errors` sean arrays;
- `fetch_errors` esté vacío.

Un manifiesto parcial o con cualquier señal de escritura/autenticación queda bloqueado. Esta validación no habilita escrituras: solo permite continuar dentro del pipeline DRY RUN.

## Handoff a planillas en DRY RUN

`n8n/discovery-manifest-bridge.mjs` transforma PDFs descubiertos en work items explícitos. Cada work item fija `GET`, `allow_redirects=false`, `auth_used=false` y `write_enabled=false`.

`n8n/official-pdf-fetch-core.mjs` implementa la descarga controlada del PDF. Revalida el work item antes de tocar la red y ejecuta únicamente `GET` con `credentials=omit`, `redirect=manual` y `Accept: application/pdf`. Falla cerrado ante cualquier redirect, status distinto de 200, Content-Type no PDF, Content-Length inválido/inconsistente, archivo que supere el límite configurado o contenido que no comience con la firma `%PDF-`. No agrega `Authorization`, `Cookie` ni headers secretos.

La salida de esa etapa sigue siendo DRY RUN (`write_enabled=false`, `auth_used=false`) y entrega bytes en memoria; no guarda archivos ni escribe en Supabase.

### Extracción PDF → texto con n8n nativo

n8n dispone del nodo core `Extract From File` con la operación `Extract From PDF`, por lo que este pipeline no necesita incorporar una librería externa ni un servicio con credenciales para extraer texto.

`n8n/pdf-extract-contract.mjs` define el contrato de handoff para la salida del nodo. Solo acepta una salida objeto con `text` no vacío, limita el tamaño del texto y valida la cantidad de páginas cuando está disponible (`numpages`, `numPages` o `pages`). No intenta OCR, no consulta servicios externos y no convierte metadata ambigua en datos del partido.

`parseN8nExtractedPlanillaDryRun()` conecta esa salida con `planilla-dry-run-core.mjs`. El work item se vuelve a validar antes del parser y la salida conserva `dry_run=true`, `write_enabled=false` y `auth_used=false`.

La topología prevista para n8n queda así:

1. discovery manifest SAFE;
2. manifest bridge → work item;
3. HTTP/PDF fetch SAFE;
4. binary data → nodo core `Extract From File` (`operation=pdf`);
5. `pdf-extract-contract.mjs`;
6. `planilla-dry-run-core.mjs`;
7. validación final sin persistencia.

`n8n/planilla-dry-run-core.mjs` recibe el work item y el texto extraído. Antes de parsear vuelve a validar URL, host, HTTPS, procedencia `/wp-content/uploads/`, ausencia de query/fragment/userinfo, método GET y flags SAFE. Luego usa `planilla-core.mjs` para extraer partido y jugadores, manteniendo la regla de que la suma de goles de jugadores debe cerrar exactamente con el marcador.

Opcionalmente acepta una identidad esperada (fecha, local, visitante y marcador) y falla cerrado si la planilla no corresponde al partido esperado. La salida conserva `dry_run=true`, `write_enabled=false` y `auth_used=false`.

## Caso de regresión oficial
La página oficial de Fecha 1 del Apertura 2026 enlaza `Sabado-21-3.pdf`. En la página 1 del PDF figura `Mayores / LHC Hipotecario Seguros / 20:15 / M / Argentinos Juniors / Ferro Carril Oeste`. Esto valida el descubrimiento del fixture.

El parser de planilla tiene además una regresión separada para la planilla digital oficial del partido Argentinos Juniors 20–27 Ferro del 2026-03-21: 16 jugadores por equipo, 47 goles totales y cierre exacto 20–27. La nueva regresión del contrato PDF usa el mismo partido para verificar el tramo `Extract From File → contrato SAFE → parser`. Esas regresiones se ejecutan en CI, pero la programación y la planilla digital se mantienen conceptualmente separadas como fuentes.

## Ejecución

`python tools/femebal_public_discovery.py --output manifest.json`

La ejecución en vivo requiere acceso HTTP del entorno. Los tests de seguridad agregados al PR no hacen red.
