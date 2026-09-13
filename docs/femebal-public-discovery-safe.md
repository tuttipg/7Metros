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

Cuando la respuesta expone un body stream, la lectura es incremental y aplica el límite de bytes durante la descarga: si el cuerpo supera `maxBytes`, cancela el reader y falla antes de acumular el resto del archivo en memoria. Esto cubre también respuestas sin `Content-Length`. Se conserva un fallback a `arrayBuffer()` para entornos/mocks sin stream, aplicando igualmente el límite antes de aceptar el artefacto.

La salida de esa etapa sigue siendo DRY RUN (`write_enabled=false`, `auth_used=false`) y entrega bytes en memoria; no guarda archivos ni escribe en Supabase. Además calcula un SHA-256 determinístico sobre los bytes exactos descargados y expone `source_url`, `content_type`, `byte_length` y `sha256` como metadata de proveniencia.

### Extracción PDF → texto con n8n nativo

n8n dispone del nodo core `Extract From File` con la operación `Extract From PDF`, por lo que este pipeline no necesita incorporar una librería externa ni un servicio con credenciales para extraer texto.

`n8n/pdf-extract-contract.mjs` define el contrato de handoff para la salida del nodo. Solo acepta una salida objeto con `text` no vacío, limita el tamaño del texto y valida la cantidad de páginas cuando está disponible (`numpages`, `numPages` o `pages`). No intenta OCR, no consulta servicios externos y no convierte metadata ambigua en datos del partido.

`parseN8nExtractedPlanillaDryRun()` conecta esa salida con `planilla-dry-run-core.mjs` y exige también la metadata del PDF descargado. El contrato vuelve a comprobar que la proveniencia siga en modo SAFE/DRY RUN, que `source_url` coincida exactamente con el work item, que el tipo siga siendo PDF, que el tamaño sea válido y que el SHA-256 tenga formato hexadecimal de 64 caracteres. El resultado del parser conserva esa proveniencia y repite el hash como `extraction.source_sha256`, de forma que una planilla parseada pueda vincularse inequívocamente al PDF binario del que salió. La metadata no habilita persistencia ni escritura.

### Wiring SAFE alrededor de Extract From File

`n8n/pdf-extraction-wiring.mjs` protege el límite entre el binario descargado y la salida de `Extract From File`. Antes de la extracción crea un envelope separado que contiene un snapshot mínimo e inmutable del work item, la proveniencia validada y un `correlation_id` igual al SHA-256 del PDF.

El envelope vuelve a calcular el SHA-256 directamente sobre `pdfArtifact.bytes` y exige que coincidan `byte_length`, hash y URL antes de permitir el handoff. Esto evita aceptar metadata correcta asociada accidentalmente a bytes de otro PDF.

Después de `Extract From File`, `parseExtractionWithEnvelopeDryRun()` exige que el mismo envelope se vuelva a unir explícitamente con el texto extraído. El rejoin falla cerrado si cambia el work item, si se pierde o altera el `correlation_id`, si la proveniencia deja de ser SAFE o si el hash final no coincide con `extraction.source_sha256`. Por diseño el envelope se mantiene separado del contenido que transforma `Extract From File`: el workflow real debe transportar/reunir ambas ramas usando `correlation_id`; no se asume que el nodo preserve campos JSON auxiliares.

La topología prevista para n8n queda así:

1. discovery manifest SAFE;
2. manifest bridge → work item;
3. HTTP/PDF fetch SAFE + SHA-256;
4. crear envelope SAFE con `correlation_id=sha256`;
5. rama binaria → nodo core `Extract From File` (`operation=pdf`);
6. rejoin explícito del texto extraído con el envelope por `correlation_id`;
7. `pdf-extract-contract.mjs` + validación de proveniencia;
8. `planilla-dry-run-core.mjs`;
9. validación final sin persistencia.

### Blueprint n8n SAFE versionado

`n8n/femebal-safe-pdf-extraction.workflow.json` materializa el tramo 4→7 como un blueprint n8n inactivo por defecto. Recibe exactamente un PDF por invocación (`binary.data`) junto con su envelope SAFE, bifurca el item en una rama de envelope y otra de extracción, usa `n8n-nodes-base.extractFromFile` con `operation=pdf`, vuelve a unir ambas ramas y revalida los flags SAFE y el `correlation_id` SHA-256 antes de emitir la extracción.

El blueprint no contiene nodos HTTP, Supabase, bases de datos, webhooks, persistencia ni `credentials`. Tampoco activa el workflow. Está pensado como artefacto importable/de referencia para el wiring DRY RUN; la ejecución real dentro de una instancia n8n sigue requiriendo conectar la entrada binaria producida por el downloader SAFE. No se afirma compatibilidad runtime hasta probarlo en una instancia n8n concreta.

`n8n/femebal-safe-workflow-smoke.mjs` valida estáticamente en CI que el workflow permanezca inactivo, que solo use tipos de nodo allowlisted, que no aparezcan marcadores de credenciales/Authorization/cookies/tokens, que `Extract From File` siga configurado para PDF sobre `binary.data`, que la bifurcación y el rejoin no desaparezcan y que los Code nodes conserven las comprobaciones `dry_run=true`, `write_enabled=false`, `auth_used=false` y SHA-256.

`n8n/planilla-dry-run-core.mjs` recibe el work item y el texto extraído. Antes de parsear vuelve a validar URL, host, HTTPS, procedencia `/wp-content/uploads/`, ausencia de query/fragment/userinfo, método GET y flags SAFE. Luego usa `planilla-core.mjs` para extraer partido y jugadores, manteniendo la regla de que la suma de goles de jugadores debe cerrar exactamente con el marcador.

Opcionalmente acepta una identidad esperada (fecha, local, visitante y marcador) y falla cerrado si la planilla no corresponde al partido esperado. La salida conserva `dry_run=true`, `write_enabled=false` y `auth_used=false`.

## Caso de regresión oficial
La página oficial de Fecha 1 del Apertura 2026 enlaza `Sabado-21-3.pdf`. En la página 1 del PDF figura `Mayores / LHC Hipotecario Seguros / 20:15 / M / Argentinos Juniors / Ferro Carril Oeste`. Esto valida el descubrimiento del fixture.

El parser de planilla tiene además una regresión separada para la planilla digital oficial del partido Argentinos Juniors 20–27 Ferro del 2026-03-21: 16 jugadores por equipo, 47 goles totales y cierre exacto 20–27. La regresión del contrato PDF usa el mismo partido para verificar el tramo `Extract From File → contrato SAFE → parser` y comprueba que el SHA-256 del PDF se propague hasta el resultado parseado. La regresión del wiring agrega la comprobación de que la correlación SHA-256 sobreviva al rejoin y rechaza bytes, metadata, URL o work items cruzados. Esas regresiones se ejecutan en CI, pero la programación y la planilla digital se mantienen conceptualmente separadas como fuentes.

## Ejecución

`python tools/femebal_public_discovery.py --output manifest.json`

La ejecución en vivo requiere acceso HTTP del entorno. Los tests de seguridad agregados al PR no hacen red.
