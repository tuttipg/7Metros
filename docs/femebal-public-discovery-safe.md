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

## Caso de regresión oficial
La página oficial de Fecha 1 del Apertura 2026 enlaza `Sabado-21-3.pdf`. En la página 1 del PDF figura `Mayores / LHC Hipotecario Seguros / 20:15 / M / Argentinos Juniors / Ferro Carril Oeste`. Esto valida el descubrimiento del fixture, pero el 20–27 debe verificarse contra la planilla digital oficial antes de importar resultado/participaciones.

## Ejecución

`python tools/femebal_public_discovery.py --output manifest.json`

La ejecución en vivo requiere acceso HTTP del entorno. Los tests no hacen red.
