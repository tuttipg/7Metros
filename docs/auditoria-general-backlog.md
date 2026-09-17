# 7Metros — Auditoría general y backlog vivo

Última actualización: 2026-09-17

Este documento registra únicamente el estado comprobado del auditor general. El frente específico FEMEBAL Community/n8n SAFE/DRY RUN y el frente de IA se mantienen separados para evitar duplicación.

## Estado base comprobado

- `main`: `46bbecda36bd003be7304df45d095bef541bbc06` (merge PR #55).
- `Validate 7Metros` #340: **success** sobre ese SHA.
- GitHub Pages #95: **success** sobre ese SHA.
- PR #55 integrado: guards fail-closed de integridad de store para equipos, planteles, partidos y participaciones, con regresiones directas.
- Issue #50: cerrado como completado.
- Issue #24: cerrado y comprobado. El ruleset `Protect main` está activo, exige PR + `Validate 7Metros`, rama actualizada, bloquea delete/force-push y no tiene bypass actors.

## CRÍTICO

No hay problemas críticos abiertos comprobados.

## ALTO

### #32 — Modelar sanciones administrativas y no-presentaciones sin inferencias

**Estado:** BLOQUEADO POR STAGING.

El contrato de persistencia append-only/fail-closed está preparado en el draft PR #35, fuera de migraciones productivas. Falta probar DDL y comportamiento real en una Supabase development branch/staging antes de promoverlo. No inferir sanciones desde marcador, fixture o ausencia de planilla.

### #36 — Reducir privilegios SQL destructivos de `authenticated`

**Estado:** BLOQUEADO POR STAGING.

El contrato de mínimo privilegio está preparado en el draft PR #37 y validado estáticamente. Falta probar CRUD legítimo, Security Advisor e integrity report en una base no productiva antes de cualquier migración.

## MEDIO

### #38 — Alinear `integrity_report_7metros` con schema y participaciones

**Estado:** BLOQUEADO POR STAGING.

El draft PR #39 corrige el contrato y agrega cobertura de participaciones; CI estático pasó. Producción no presenta violaciones conocidas en los invariantes auditados, pero el nuevo SQL todavía no fue ejecutado en una base real no productiva.

### Metadatos incompletos de clubes

**Estado:** PENDIENTE.

La auditoría histórica detectó logos, abreviaturas y ciudades faltantes. La web posee fallbacks, por lo que no es un bloqueo funcional. Completar sólo con fuentes verificables y sin inventar datos.

### Rendimiento con crecimiento de datos

**Estado:** PENDIENTE / PREVENTIVO.

La carga actual todavía es pequeña en jugadores/participaciones frente al volumen de partidos. Revisar paginación, consultas y render cuando crezca la cobertura; no eliminar índices marcados como poco usados sin evidencia de carga real.

## BAJO

### Documentación de auditoría desactualizada

**Estado:** CORREGIDO EN ESTE CAMBIO.

El backlog todavía indicaba erróneamente que #24 estaba abierto y no reflejaba la consolidación de #50/#55. Se sincronizó el documento con `main`, CI, Pages, issues y PRs actuales.

## PRs abiertos que NO deben consolidarse desde este auditor

- PR #34: frente FEMEBAL Community/n8n SAFE/DRY RUN; mantener separado.
- PR #43: frente IA; requiere evidencia sobre video real antes de salir de draft.
- PR #35, #37 y #39: drafts deliberadamente bloqueados hasta disponer de Supabase staging/development branch y evidencia real.

## REQUIERE INTERVENCIÓN DE TOMÁS

No hay intervención urgente para mantener la web estable.

Para desbloquear #32, #36 y #38 hace falta disponer de una Supabase development branch/staging donde ejecutar DDL y pruebas sin riesgo para producción. Hasta entonces esos drafts no deben mergearse ni convertirse en migraciones productivas.

## Próximas prioridades autónomas

1. Auditar exactitud de estadísticas y scope sobre el `main` consolidado, buscando regresiones no cubiertas por tests.
2. Auditar carga/UX/mobile y convertir hallazgos reproducibles en cambios pequeños con smoke tests.
3. Revisar rendimiento/paginación sin cambios destructivos ni optimizaciones especulativas.
4. Completar metadatos visuales únicamente cuando exista fuente verificable.
5. Mantener #35/#37/#39 bloqueados hasta staging y evitar acumular nuevos drafts que dependan de la misma evidencia.
