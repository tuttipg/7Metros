# Evidencia pública FEMEBAL — programación 13/14 de junio de 2026

Estado: **SAFE / documentación solamente / sin probing de endpoints inferidos**.

## Fuente oficial

- Página pública oficial FEMEBAL: https://femebal.com/programacion-sabado-13-y-domingo-14-de-junio/
- Publicada: 2026-06-10.
- La página enlaza explícitamente dos descargas: `Fecha 8 (Sabado con Árbitros)` y `Fecha 12 (Domingo con Árbitros)`.

## Hallazgo

Esta publicación es evidencia oficial de que el calendario del Torneo Metropolitano Apertura 2026 no siempre se publicó bajo un slug uniforme `programacion-fecha-N-torneo-metropolitano-apertura-2026`.

En particular, una única publicación agrupa:

- Fecha 8: sábado 13/06/2026.
- Fecha 12: domingo 14/06/2026.

Por lo tanto, el descubrimiento histórico **no debe construir ni probar automáticamente slugs de fechas faltantes**. Debe partir de enlaces públicos explícitos/indexados y conservar la página que aporta la evidencia.

## Límites de la evidencia

Esta página demuestra la existencia y fecha de las programaciones enlazadas. Por sí sola no demuestra:

- participantes de un partido concreto;
- marcador;
- estadísticas individuales;
- identidad de una planilla de partido.

Esos datos requieren inspeccionar la descarga oficial explícitamente enlazada o una fuente oficial independiente, manteniendo separadas las afirmaciones por procedencia.

## Implicación SAFE

El hallazgo refuerza la política fail-closed actual: no inferir URLs por patrón y no ejecutar candidatos TournamentTracker/endpoints sólo porque una ruta parezca predecible. Los enlaces explícitos de páginas oficiales pueden incorporarse como evidencia de descubrimiento y luego someterse a las validaciones existentes antes de cualquier GET permitido.
