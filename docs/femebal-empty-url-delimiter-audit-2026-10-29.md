# Auditoría SAFE: delimitadores vacíos en URLs FEMEBAL — 2026-10-29

## Hallazgo

La política compartida `n8n/official-url-policy.mjs` comprobaba `URL.hash` y `URL.search` después de construir un objeto WHATWG `URL`. En Node.js, un delimitador raw final como `#` o `?` puede quedar representado como hash/query vacíos. Por ello, la comprobación posterior podía no distinguir:

- `https://www.femebal.com/fixture`
- `https://www.femebal.com/fixture#`
- `https://www.femebal.com/fixture?`

La misma inconsistencia alcanzaba los paths PDF: la canonicalización podía quitar los delimitadores vacíos al devolver la URL canónica.

Esto es un defecto de validación local; no implica que un endpoint real de FEMEBAL sea vulnerable.

## Corrección

La política rechaza el carácter `#` literal antes de parsear y rechaza `?` literal cuando el parser no produce una query no vacía. Se aplica tanto a páginas oficiales como a PDFs, incluidos los del árbol `/pdf_planillas/`.

## Regresiones añadidas

`n8n/official-url-policy-smoke.mjs` comprueba siete variantes:

- página con fragmento vacío;
- página con query vacía;
- página con query válida seguida de fragmento vacío;
- PDF de programación con query o fragmento vacío;
- PDF de planilla con query o fragmento vacío.

Los casos de filtros legítimos de lectura, nombres sensibles y tracking permanecen en la suite existente.

## Seguridad y límites

- No se hizo ninguna petición a endpoints internos.
- No se habilitó probing automático.
- No se usaron credenciales, cookies, tokens ni encabezados `Authorization`.
- No se modificó Supabase ni producción.
- La URL de planilla usada en regresiones es un fixture; no prueba que se haya descargado el PDF real.
- El resultado de CI debe comprobarse sobre el commit final antes de declarar la regresión validada.
