# Auditoría de identidad esperada en parser DRY RUN — 2026-10-29

## Hallazgo

En `n8n/planilla-dry-run-core.mjs`, `assertExpectedMatch()` comparaba los campos de identidad que se proporcionaban, pero marcaba `expected_match_checked=true` con sólo fecha, equipos y marcador. Eso permitía que una expectativa parcial se presentara como una comprobación completa aunque faltaran hora, categoría y división.

No era una escritura ni un problema de acceso; era una etiqueta de validación demasiado fuerte para la evidencia aportada.

## Corrección

El indicador ahora sólo es `true` cuando se suministran y coinciden todos los discriminadores requeridos:

- fecha;
- hora;
- categoría;
- división;
- equipo local y visitante;
- goles de ambos equipos.

Los campos suministrados se siguen comparando individualmente: un valor incorrecto continúa produciendo error. Una expectativa parcial que coincide en fecha, equipos y marcador devuelve `expected_match_checked=false`.

## Regresión

Se añadió un caso en `n8n/planilla-dry-run-core-smoke.mjs` que pasa fecha, equipos y marcador correctos pero omite hora, categoría y división. El contrato esperado es que no se anuncie como verificación completa.

La fixture existente del partido control Argentinos Juniors 20–27 Ferro del 21/03/2026 continúa utilizando la identidad completa (20:15, Mayores, LHC Hipotecario Seguros). Es una regresión sintética del parser, no evidencia de que el PDF conocido se haya descubierto desde una página oficial real.

## Seguridad y límites

- Sólo cambio de parser y smoke test en la rama de trabajo.
- Sin solicitudes de red nuevas, credenciales, tokens, cookies ni encabezados `Authorization`.
- Sin escrituras de Supabase ni cambios de producción.
- No se modificó la procedencia declarada por los work items.

## Validación

El smoke específico `n8n/planilla-dry-run-core-smoke.mjs` y la suite de integración SAFE pasaron en GitHub Actions tras completar el contrato de identidad esperado. Los cuatro workflows del commit de prueba `f32039d8d4816f6e4dffe1a37aa4f6eba6556318` terminaron con `success`:

- Validate 7Metros: run 756.
- FEMEBAL SAFE smoke isolation: run 142.
- TournamentTracker PDF work-item SAFE regression: run 146.
- PDF extraction provenance SAFE regression: run 138.

Se ejecutó además un microtest Node aislado de la condición de completitud: identidad completa aceptada; identidad parcial y hora malformada no marcadas como completas. No se afirma que se haya ejecutado localmente la suite completa del repositorio.
