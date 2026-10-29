# Control de evidencia pública FEMEBAL — 2026-10-29

## Resultado

La programación oficial del sábado 21/03/2026 confirma el partido masculino de LHC entre Argentinos Juniors y Ferro Carril Oeste a las 20:15. El PDF oficial enumera por separado el encuentro femenino de ambos clubes a las 18:30. Esta fuente confirma calendario y contexto; **no es la planilla final ni demuestra el marcador 20–27**.

Fuentes públicas consultadas:

- Página oficial de programación: https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/
- PDF de programación del sábado: https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf
- La página de programación muestra cuatro enlaces de descarga de programación (sábado 21, domingo 22, lunes 23 y martes 24). En el contenido público revisado no aparece un enlace a la planilla final del partido.

## Aclaración de procedencia de los tests

En `tests/test_femebal_public_discovery.py`, la constante `PAGE` es HTML **sintético de prueba**. Incluye deliberadamente el enlace conocido `5ce377051ea0acb1.pdf` para ejercitar allowlist, canonicalización, deduplicación y contrato de proveniencia. Los tests `test_pdf_discovery_allowlist_and_provenance` y `test_manifest_carries_control_planilla_without_enabling_writes` verifican el comportamiento del parser ante ese fixture; no son una captura ni una prueba de que la página oficial en vivo enlaza esa planilla.

Por tanto, `provenance='public_explicit_link'` en esos tests significa “el HTML de entrada contiene un enlace explícito”, dentro del fixture sintético. No debe utilizarse como evidencia de descubrimiento real del PDF de control.

## Evidencia y límites

- El fixture oficial confirma programación del 21/03/2026 y el horario masculino de 20:15.
- La programación no demuestra por sí sola el resultado final 20–27.
- No se encontró en esta revisión un enlace oficial público nuevo a la planilla final del partido de control.
- No se descargó el PDF de control ni se calculó su SHA-256 en esta ejecución.
- La búsqueda pública de `/documentos/` sí ha encontrado planillas de otras fechas/partidos, pero no se deben atribuir al control ni aceptar todos los PDF de ese directorio como planillas.
- No se usaron credenciales, cookies, tokens ni encabezados `Authorization`; no se enumeraron identificadores; no hubo escrituras en Supabase.

## Siguiente paso seguro

Mantener el PDF de control como fixture de regresión conocido, pero separar claramente esa función de la proveniencia de descubrimiento real. Sólo marcarlo como descubierto desde una fuente pública cuando se capture una página oficial real que lo enlace explícitamente, y conservar la página de origen junto con la evidencia de descarga y el SHA-256 del cuerpo exacto.
