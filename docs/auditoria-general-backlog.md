# 7Metros — Auditoría general y backlog vivo

Última actualización: 2026-09-12

Este documento registra problemas comprobados, hipótesis y deuda técnica del proyecto. El objetivo es mantener una única lista priorizada y evitar repetir auditorías ya realizadas.

## CRÍTICO

No hay problemas críticos abiertos comprobados en esta ejecución.

## ALTO

### ABIERTO — Resultados/planillas del Clausura 2026 todavía ausentes

**Estado:** COMPROBADO · frente paralelo en curso

- `temporada_id=3` contiene 2.689 partidos.
- Rango de fechas actualmente cargado: 2026-08-08 a 2026-09-11.
- Al 2026-09-12, los 2.689 ya están en fecha pasada y siguen sin marcador y sin planilla importada.
- La integridad estructural pasa (`integrity_report_7metros(3).ok=true`), por lo que el problema no es corrupción sino **frescura/cobertura de datos**.

**Acción:** no duplicar aquí el frente específico que ya trabaja descubrimiento de partidos/planillas, FEMEBAL Community y n8n SAFE/DRY RUN. Este auditor debe vigilar el impacto en web, integridad y trazabilidad.

### ABIERTO — Falta representar no-presentaciones/sanciones en el puntaje

**Estado:** COMPROBADO · diseño pendiente

Fe.Me.Bal. usa 3 puntos por victoria, 2 por empate, 1 por derrota ordinaria y 0 por no-presentación. `partidos` todavía no posee un campo explícito/trazable de no-presentación ni overrides de puntos por equipo. No debe inferirse una sanción desde un marcador.

**Acción siguiente:** definir un modelo explícito de resultado administrativo/override con fuente oficial antes de implementarlo en posiciones.

### ABIERTO — Desempate a partido por el 1.º puesto de LHC

**Estado:** COMPROBADO · semántica final pendiente

El Sistema de Competencia de Liga de Honor Hipotecario Seguros 2026 indica que, si dos equipos terminan empatados en el 1.º puesto del Apertura o Clausura, el campeonato se define con un partido desempate. El ordenamiento web ya aplica correctamente el Sistema Olímpico para empates ordinarios, pero todavía no representa el estado especial “1.º puesto pendiente de desempate”.

**Acción siguiente:** incorporar una señal explícita de desempate pendiente únicamente cuando pueda determinarse que la fase terminó; no declarar campeón por criterios secundarios en ese caso.

### RESUELTO — Fichas de club y partido podían mostrar otra entidad

**Estado:** COMPROBADO, CORREGIDO Y VALIDADO EN CI

Las fichas usaban fallback silencioso al primer club/partido del filtro cuando el ID solicitado no existía en el contexto actual. Se agregó resolución fail-closed y contexto efímero:
- IDs inexistentes dejan de convertirse en otra entidad;
- `?team=` explícito se valida contra la entidad;
- un único contexto compatible se resuelve sin persistir filtros;
- clubes con múltiples contextos obligan a elegir competencia;
- partidos con equipos/contextos inconsistentes no se muestran como si fueran válidos.

La regresión `scoped-route-smoke.mjs` quedó integrada a CI. PR #19 pasó `Validate 7Metros` y fue mergeado a `main`; issue #17 cerrado.

### RESUELTO — Fixtures vencidos se confundían con próximos partidos

**Estado:** COMPROBADO, CORREGIDO Y VALIDADO EN CI

Los partidos con fecha pasada, sin marcador y estado persistido `programado` ahora reciben únicamente en UI el rótulo derivado `Resultado pendiente`. No se modifica `partidos.estado`, no se infiere que el encuentro se haya disputado y no se inventa marcador.

La capa de presentación actualiza tarjetas, compactos, tablas y ficha de partido después de cada render. `match-freshness-smoke.mjs` cubre pasado sin resultado, hoy, futuro y finalizado. PR #20 pasó toda la suite de CI y fue mergeado a `main`; issue #18 cerrado.

### RESUELTO — Ficha de jugador podía mostrar otra persona por filtros guardados

**Estado:** COMPROBADO, CORREGIDO Y VALIDADO EN CI

El Inicio usa destacados LHC/LHD independientemente de los filtros guardados, mientras `getPlayer()` se resolvía dentro de la competencia filtrada. Si el ID solicitado no existía allí, `renderPlayerDetail()` podía caer en el primer jugador del filtro y mostrar una identidad incorrecta.

Se agregó resolución fail-closed de contexto de jugador:
- conserva el contexto actual cuando corresponde;
- resuelve automáticamente una única pertenencia de temporada;
- acepta `?team=` explícito para multi-plantel;
- ante varias pertenencias sin contexto obliga a elegir;
- IDs inexistentes o un `team` ajeno al jugador ya no se transforman silenciosamente en otro perfil;
- el cambio de contexto de la ficha es efímero y no pisa los filtros guardados en `localStorage`.

La regresión `player-route-smoke.mjs` quedó integrada a CI. PR #16 pasó `Validate 7Metros` y fue mergeado a `main`.

### RESUELTO — Puntaje incorrecto 2-1-0 en posiciones

**Estado:** COMPROBADO Y CORREGIDO

La web y `v_standings` usaban `2*PG + PE`. Se corrigió a 3-2-1 en frontend y Supabase. Se agregaron regresiones a CI.

Verificación sobre Apertura 2026:
- Ferro Carril Oeste, 1 victoria: 3 puntos.
- Argentinos Juniors, 1 derrota: 1 punto.

Durante la migración el Advisor detectó que `CREATE OR REPLACE VIEW` había dejado `v_standings` como security definer. Se corrigió inmediatamente a `security_invoker=true`, se agregó protección al archivo de migración y el Security Advisor volvió a 0 lints.

### RESUELTO — Desempate de posiciones ignoraba Sistema Olímpico

**Estado:** COMPROBADO Y CORREGIDO

La web ordenaba empates por diferencia de gol general antes de considerar los enfrentamientos entre los equipos empatados. Se agregó `standings-core.mjs` para aplicar primero mini-tabla/resultados entre empatados y luego criterios generales, con regresiones para empate de dos equipos, empate múltiple y ausencia de enfrentamientos.

## MEDIO

### ABIERTO — Metadatos incompletos de clubes

**Estado:** COMPROBADO

`v_data_quality_summary` informa:
- 19 clubes sin logo;
- 107 clubes sin abreviatura persistida;
- 107 clubes sin ciudad persistida.

La web tiene fallbacks para abreviatura/logo, por lo que no rompe funcionalidad, pero reduce calidad visual y de perfiles. Completar únicamente con fuentes verificables.

### RESUELTO — PR histórico #7 era incompatible con el estado actual

**Estado:** COMPROBADO Y CERRADO SIN MERGE

La auditoría de `autonomous/full-platform-upgrade-2026-09-09` confirmó que la rama estaba supersedida y contenía regresiones ya corregidas en `main`, entre ellas puntaje 2-1-0 (`won * 2 + drawn`) y una definición antigua de `v_standings`, además de código previo a hardenings posteriores de importación, seguridad e integridad.

El PR #7 se cerró explícitamente como obsoleto. Si alguna pieza visual o funcional sigue siendo útil, debe recuperarse de forma selectiva y volver a validarse contra `main`; no reutilizar la rama completa.

### OBSERVADO — Índices marcados como no usados

**Estado:** INFO, sin acción destructiva

Supabase Performance Advisor informa 14 índices sin uso observado. Varios corresponden a IA/importación todavía con tablas vacías o poco tráfico. No borrarlos de forma especulativa; reevaluar con carga real y estadísticas de consultas.

## BAJO

### RESUELTO — PR #5 obsoleto abierto

**Estado:** CORREGIDO

Se cerró PR #5 como supersedido por PR #6 ya mergeado, reduciendo ruido y riesgo de aplicar una corrección duplicada de escudos.

## Estado general verificado

- 107 clubes.
- 1.154 equipos.
- 32 jugadores y 32 planteles.
- 2.690 partidos totales.
- 32 participaciones y 5 sanciones.
- 0 lanzamientos, 0 acciones defensivas, 0 videos cargados.
- `integrity_report_7metros(3).ok=true`.
- `integrity_report_7metros(4).ok=true`.
- Security Advisor: 0 lints tras el hardening de `v_standings`.
- CI pasa para puntaje 3-2-1, desempate olímpico, contexto seguro de jugador, contexto seguro de club/partido y frescura de resultados.

## REQUIERE INTERVENCIÓN DE TOMÁS

Nada obligatorio en este momento. El frente específico de FEMEBAL Community/n8n puede seguir requiriendo pruebas manuales independientes, pero este auditor general tiene trabajo seguro para continuar sin intervención.

## Próximas prioridades

1. Diseñar y validar representación explícita de no-presentación/sanciones administrativas sin inferir datos.
2. Representar correctamente el desempate a partido por 1.º puesto una vez finalizada la fase.
3. Revisar integridad de jugadores que cambien de equipo/temporada y evitar agregaciones históricas ambiguas más allá de la navegación ya corregida.
4. Auditar responsive/mobile de tablas, filtros, partidos y perfiles con regresiones estáticas donde sea posible.
5. Completar logos/metadatos de clubes solo desde fuentes verificables.
6. Revisar rendimiento y paginación del frontend a medida que participaciones/jugadores crezcan desde el volumen actual reducido.
