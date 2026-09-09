# 7Metros — Roadmap de producto

Actualizado: 2026-09-09

Este archivo es la fuente de verdad del avance técnico. Evita depender de conversaciones para recordar qué está terminado, qué depende de datos y qué requiere infraestructura externa.

## Estado

### Base pública — implementado
- Navegación con iconos y acceso a Inicio, Competiciones, Posiciones, Partidos, Clubes, Jugadores, Planteles, Estadísticas, Cobertura, Comparar y Reportes.
- Inicio sin filtros de competencia.
- KPI globales calculados desde Supabase: clubes, jugadores, partidos, goles y promedio.
- Portada deportiva priorizada en LHC + LHD.
- Directorio global de clubes en Inicio.
- Categorías ordenadas: Infantiles → Menores → Cadetes → Juveniles → Juniors → Mayores.
- Directorio de competiciones a partir de equipos reales.
- Perfiles de club y vista global multi-competencia.
- Fichas de partido con trazabilidad a fuentes cuando existen.
- Tablas de posiciones calculadas desde resultados.
- Rankings de jugadores preparados para participaciones.
- Buscador global.
- Comparador de equipos; comparador individual se activa al existir jugadores.
- Página de cobertura que distingue fixture de resultados y analítica profunda.
- Identidad visual y normalización de escudos.
- Responsive y estados de carga/error.

### Datos y Supabase — implementado
- RLS activo en tablas públicas.
- Helpers privilegiados encapsulados en schema `private` y wrappers `SECURITY INVOKER`.
- Vistas `security_invoker` para resumen global, catálogo de competiciones, calidad, posiciones y totales de jugadores.
- Índices para consultas de temporada, fecha y estado.
- `jugador_aliases` para resolver variantes de nombres.
- `import_runs` para auditoría de ejecuciones.
- `ai_jobs` y `ai_eventos` para pipeline de video.
- Calidad de datos observable sin inventar métricas.
- Panel administrativo autenticado y protegido por RLS.

### Importación — base implementada
- CLI versionado en `tools/femebal_importer.py`.
- Normalización de nombres, fingerprints idempotentes, dry-run y carga por API.
- Registro de ejecuciones y errores preparado.
- La extracción automática de cada formato nuevo de PDF debe validarse contra muestras reales antes de publicarse.

### IA / video — arquitectura implementada
- Contrato de detecciones y tracks.
- Pipeline desacoplado de publicación estadística.
- Jobs, eventos, timestamp, confianza, bbox y revisión.
- Evaluador de tracking/detección preparado.
- Página pública IA / Video Lab.

## Bloqueos de datos actuales

A 2026-09-09 la base contiene fixture amplio, pero todavía no contiene jugadores, participaciones, resultados ni videos en las tablas de producción. Por eso no es correcto mostrar goleadores, efectividad, mapas de tiro, defensa avanzada ni precisión real del modelo. Esas funciones están diseñadas para activarse con datos reales.

## Próximos hitos basados en datos

1. Importar resultados oficiales de partidos ya disputados.
2. Importar planteles y participaciones desde planillas oficiales.
3. Vincular videos disponibles a `videos_partidos`.
4. Crear dataset anotado inicial de video: pelota, jugador, dorsal, arco y cancha.
5. Entrenar baseline y medir precisión, recall, IDF1/HOTA y calidad de eventos.
6. Añadir mapas de lanzamiento y arquero a partir de eventos revisados.
7. Habilitar comparación individual, líderes y rendimiento defensivo.

## Regla de producto

Una métrica no aparece como real hasta que la fuente existe. Fixtures, resultados, participaciones, eventos de IA y eventos revisados se consideran capas distintas. Esta regla es prioritaria frente a llenar la interfaz con datos simulados.
