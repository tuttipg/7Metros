# Auditoría de ruta pública FEMEBAL /documentos/ — 2026-10-29

## Hallazgo

Una búsqueda web pública encontró y permitió abrir un PDF oficial de FEMEBAL alojado en la ruta /documentos/:

https://www.femebal.com/documentos/Semi%201%20AAAJ%20B%20-%20Temperley.pdf

El PDF de dos páginas se titula “Datos del partido” y expone una planilla cerrada con metadatos de temporada, torneo, rama, categoría, división, fecha, árbitros, marcador, dorsales, nombres, goles y sanciones. El contenido identifica un encuentro femenino de Mayores de 2023 entre Argentinos Juniors B y Temperley, marcador 27–25.

## Relevancia para el descubrimiento

Esta es una familia de rutas públicas distinta de las dos categorías que reconoce hoy tools/femebal_public_discovery.py: programaciones en /wp-content/uploads/ y planillas bajo /pdf_planillas/ en el host CloudFront conocido.

La fuente demuestra que existe al menos una planilla oficial pública indexable en /documentos/. No demuestra que todas las rutas bajo /documentos/ sean planillas: podrían existir reglamentos u otros PDFs. Por eso no se amplió la allowlist automáticamente ni se clasificó el directorio completo como planillas.

## Comparación con el partido de control

El PDF hallado no corresponde al control Argentinos Juniors 20–27 Ferro del 21/03/2026. Es de 2023, rama femenina, Argentinos Juniors B–Temperley, marcador 27–25. Se registra como evidencia de una familia de documentos, no como evidencia del partido control.

Para el control siguen pendientes una referencia pública oficial inequívoca y el enlace a su planilla final.

## Siguiente paso seguro

Antes de ampliar el descubridor, buscar enlaces explícitos desde páginas oficiales FEMEBAL hacia PDFs bajo /documentos/ y definir una regla estrecha de clasificación que use procedencia y señales del documento, no sólo el prefijo de la URL. Añadir fixtures representativos positivos y negativos (planilla, reglamento, documento no estadístico) y validar que ningún PDF no-planilla entre como planilla_partido_pdf.

## Límites

- Fuente consultada mediante búsqueda pública y apertura del PDF; no se usó autenticación.
- No se ejecutaron endpoints de aplicación ni se enumeraron rutas.
- No se descargó ni importó el PDF al pipeline; no se calculó SHA-256 de un archivo local.
- No se usaron credenciales, cookies, tokens ni encabezados Authorization.
- No hubo escrituras en Supabase ni cambios de producción.