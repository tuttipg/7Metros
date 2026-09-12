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

### ABIERTO — PR histórico #7 requiere auditoría antes de reutilizar

**Estado:** PENDIENTE

`autonomous/full-platform-upgrade-2026-09-09` contiene cambios amplios anteriores a varios hardenings posteriores. No debe mergearse completo sin revisar conflicto por conflicto. Recuperar únicamente piezas todavía útiles y actuales.

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
- La validación de GitHub CI pasa para los cambios de puntaje y desempate.

## REQUIERE INTERVENCIÓN DE TOMÁS

Nada obligatorio en este momento. El frente específico de FEMEBAL Community/n8n puede seguir requiriendo pruebas manuales independientes, pero este auditor general tiene trabajo seguro para continuar sin intervención.

## Próximas prioridades

1. Diseñar y validar representación explícita de no-presentación/sanciones administrativas sin inferir datos.
2. Auditar UX ante temporadas con fixtures vencidos pero resultados todavía no importados, para mostrar cobertura/frescura con claridad sin inventar marcadores.
3. Revisar integridad de jugadores que cambien de equipo/temporada y evitar agregaciones históricas ambiguas.
4. Auditar responsive/mobile de tablas, filtros, partidos y perfiles con regresiones estáticas donde sea posible.
5. Completar logos/metadatos de clubes solo desde fuentes verificables.
