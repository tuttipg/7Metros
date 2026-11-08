# Evidencia pública FEMEBAL — programación 13/14 de junio de 2026

Estado: **SAFE / documentación solamente / sin probing de endpoints inferidos**.

## Fuente oficial

- Página pública oficial FEMEBAL: https://femebal.com/programacion-sabado-13-y-domingo-14-de-junio/
- Publicada: 2026-06-10.
- La página enlaza explícitamente dos descargas: `Fecha 8 (Sabado con Árbitros)` y `Fecha 12 (Domingo con Árbitros)`.
- PDF oficial Fecha 8: https://femebal.com/wp-content/uploads/2026/06/Fecha-8-Sabado-con-Arbitros.pdf
- PDF oficial Fecha 12: https://femebal.com/wp-content/uploads/2026/06/Fecha-12-Domingo-con-Arbitros.pdf

## Hallazgo

Esta publicación es evidencia oficial de que el calendario del Torneo Metropolitano Apertura 2026 no siempre se publicó bajo un slug uniforme `programacion-fecha-N-torneo-metropolitano-apertura-2026`.

En particular, una única publicación agrupa:

- Fecha 8: sábado 13/06/2026.
- Fecha 12: domingo 14/06/2026.

Por lo tanto, el descubrimiento histórico **no debe construir ni probar automáticamente slugs de fechas faltantes**. Debe partir de enlaces públicos explícitos/indexados y conservar la página que aporta la evidencia.

## Identidades LHC verificadas en Fecha 8

La descarga oficial explícitamente enlazada para el sábado 13/06/2026 permite verificar, sin inferir resultados ni planillas, dos identidades relevantes para el alcance inicial de 7Metros:

- `Mayores / LHC Hipotecario Seguros / M / 18:00`: **Estudiantes de La Plata — Ferro Carril Oeste**.
- `Mayores / LHC Hipotecario Seguros / M / 20:15`: **S.A.G. Polvorines — S.A.G. Villa Ballester**.

Estas filas se consideran exclusivamente evidencia de **identidad programada del partido**. No acreditan que el partido se haya disputado, ni su marcador, ni una planilla digital concreta, ni estadísticas de jugadores.

El mismo PDF contiene otras apariciones de Ferro y Villa Ballester en categorías/divisiones diferentes. Eso refuerza que una coincidencia por club+fecha no es suficiente: para este frente debe conservarse el filtro compuesto `Mayores + LHC Hipotecario Seguros + M`.

## Fecha 12 — clasificación fail-closed

La descarga oficial explícitamente enlazada para el domingo 14/06/2026 fue revisada como programación completa de esa fecha. En el texto publicado no aparece la división `LHC Hipotecario Seguros`.

Sí aparecen Ferro Carril Oeste y S.A.G. Villa Ballester en otras divisiones, por ejemplo:

- `Mayores / Liga de Honor Plata / M / 18:00`: **Club Comunicaciones — Ferro Carril Oeste**.
- `Mayores / 1º Division / M / 18:30`: **C.A. Platense — Ferro Carril Oeste**.
- `Mayores / 3º Division / M / 18:00`: **Palermo Handball — S.A.G. Villa Ballester**.
- `Mayores / 2º Division / M / 19:45`: **C.D.S. Juventud Unida — S.A.G. Villa Ballester**.
- `Mayores / Liga de Honor Plata / M / 18:00`: **S.A.G. Villa Ballester — UBA**.

Por eso Fecha 12 queda clasificada únicamente como **`not_found_in_official_schedule` para el filtro `Mayores + LHC Hipotecario Seguros + M` de Ferro/Ballester**. Esta clasificación describe la evidencia observada en ese PDF; **no equivale** a `bye`, suspensión, reprogramación ni inexistencia del partido.

## Límites de la evidencia

La página de publicación demuestra la existencia y fecha de las programaciones enlazadas. El PDF oficial de Fecha 8 agrega las dos identidades programadas anteriores. El PDF oficial de Fecha 12 permite afirmar solamente que no se localizó una fila que supere el filtro LHC definido en esa programación. Ninguna de esas fuentes, por sí sola, demuestra:

- marcador o resultado final;
- que un encuentro programado efectivamente se haya disputado;
- estadísticas individuales;
- identidad de una planilla digital de partido;
- que una ausencia en la programación implique bye, suspensión o reprogramación.

Esos datos requieren una fuente oficial independiente apropiada, manteniendo separadas las afirmaciones por procedencia.

## Implicación SAFE

El hallazgo refuerza la política fail-closed actual: no inferir URLs por patrón y no ejecutar candidatos TournamentTracker/endpoints sólo porque una ruta parezca predecible. Los enlaces explícitos de páginas oficiales pueden incorporarse como evidencia de descubrimiento y luego someterse a las validaciones existentes antes de cualquier GET permitido.
