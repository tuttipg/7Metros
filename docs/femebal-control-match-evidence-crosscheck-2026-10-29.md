# Control de evidencia pública FEMEBAL — 2026-10-29

## Resultado

La programación oficial del sábado 21/03/2026 confirma el partido masculino de LHC entre Argentinos Juniors y Ferro Carril Oeste a las 20:15. El PDF oficial enumera por separado el encuentro femenino de ambos clubes a las 18:30.

Una búsqueda pública también devolvió contenido indexado de la ruta oficial TournamentTracker de Liga de Honor masculina: `https://www.femebal.com/tournament-tracker/RUdVX3VheVA=`. El resultado indexado muestra el encuentro del sábado 21 de marzo a las 20:15 y el marcador A.A. Argentinos Juniors 20–27 Ferro Carril Oeste. Esto aporta corroboración pública oficial del marcador que no estaba contenida en el PDF de programación.

**Límite importante:** al abrir directamente la ruta TournamentTracker, el documento HTML accesible estático sólo muestra “You need to enable JavaScript to run this app”. El marcador se observó en el resultado indexado de búsqueda, no mediante una extracción estática del contenido completo de la aplicación. La ruta ya es conocida en la regresión SAFE de rutas indexadas; no se ejecutó el JavaScript ni se llamó a endpoints internos.

Fuentes públicas consultadas:

- Página oficial de programación: https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/
- PDF oficial del sábado: https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf
- Ruta oficial TournamentTracker de LHC masculino: https://www.femebal.com/tournament-tracker/RUdVX3VheVA%3D

La página de programación muestra enlaces de descarga para las programaciones del sábado 21, domingo 22, lunes 23 y martes 24. En el contenido público revisado no aparece un enlace a la planilla final del partido.

## Aclaración de procedencia de los tests

En `tests/test_femebal_public_discovery.py`, la constante `PAGE` es HTML **sintético de prueba**. Incluye deliberadamente el enlace conocido `5ce377051ea0acb1.pdf` para ejercitar allowlist, canonicalización, deduplicación y contrato de proveniencia. Los tests `test_pdf_discovery_allowlist_and_provenance` y `test_manifest_carries_control_planilla_without_enabling_writes` verifican el comportamiento del parser ante ese fixture; no son una captura ni una prueba de que la página oficial en vivo enlaza esa planilla.

Por tanto, `provenance='public_explicit_link'` en esos tests significa “el HTML de entrada contiene un enlace explícito”, dentro del fixture sintético. No debe utilizarse como evidencia de descubrimiento real del PDF de control.

## Evidencia y límites

- El fixture oficial confirma la programación del 21/03/2026 y el horario masculino de 20:15.
- El resultado indexado de la ruta oficial TournamentTracker corrobora el marcador 20–27 y la identidad del encuentro; la página abierta directamente no expone el contenido sin JavaScript.
- No se encontró en esta revisión un enlace oficial público a la planilla final del partido de control.
- No se descargó el PDF de control ni se calculó su SHA-256 en esta ejecución.
- La búsqueda pública de `/documentos/` ha encontrado planillas de otras fechas/partidos, pero no se deben atribuir al control ni aceptar todos los PDF de ese directorio como planillas.
- No se usaron credenciales, cookies, tokens ni encabezados `Authorization`; no se enumeraron identificadores; no hubo escrituras en Supabase.

## Siguiente paso seguro

Mantener el PDF de control como fixture de regresión conocido, pero separar claramente esa función de la proveniencia de descubrimiento real. Sólo marcarlo como descubierto desde una fuente pública cuando se capture una página oficial real que lo enlace explícitamente, y conservar la página de origen junto con la evidencia de descarga y el SHA-256 del cuerpo exacto. La ruta indexada confirma el marcador, pero no sustituye la planilla ni autoriza probes del runtime TournamentTracker.
