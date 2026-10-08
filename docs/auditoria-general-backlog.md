# 7Metros — Auditoría general y backlog vivo

Última actualización: 2026-10-08

Este documento registra únicamente el estado comprobado por el auditor general. El frente específico FEMEBAL Community/n8n SAFE/DRY RUN y el frente de IA se mantienen separados para evitar duplicación.

## Estado base comprobado

- `main`: `aea913b0807d435d998b69c6a9d10155f904337a` (merge PR #62).
- Para ese SHA, la consulta actual devuelve **0 workflow runs recuperables** y **0 status checks recuperables**.
- El hotfix de Pages de #62 está integrado: versiona `script.js`, `pages.js`, `features.js` y `api.js` con `20260919-home4` y protege el bootstrap frente a una API vieja en caché.
- El estado público actual de GitHub Pages **no está comprobado en esta ejecución**; no se afirma que esté roto ni sano sin evidencia reproducible.
- Issue #58 sigue abierto porque el `main` actual todavía construye partidos con `id: Number(row.id)` sin `Number.isFinite` previo.
- PR #63 contiene el guard fail-closed y la regresión de ID no numérico. Su HEAD exacto ya tiene evidencia de `Validate 7Metros` verde (run #609), pero el PR continúa en Draft.
- PR #39 contiene el contrato estático de `integrity_report_7metros`; su HEAD tiene `Validate 7Metros` verde (run #215), pero falta probar SQL real en Supabase staging/development.
- PR #43 continúa experimental y aislado de producción; no hay ground truth suficiente para convertir las heurísticas de pelota/posesión/eventos en estadísticas oficiales.
- Issue #64 conserva una descripción histórica sobre branch protection. El estado administrativo actual de rulesets/branch protection **no queda comprobado por esta ejecución**; no se debe declarar resuelto ni modificar settings desde este auditor sin evidencia fresca.

## CRÍTICO

No hay problemas críticos abiertos comprobados.

## ALTO

### #58 / #63 — rechazar partidos con ID inválido

**Estado:** corrección implementada y comprobada por CI sobre el HEAD exacto de #63; consolidación **BLOQUEADA POR DRAFT**.

La corrección convierte y valida el ID antes de construir la entidad. La regresión usa un partido con equipos válidos pero ID no numérico y exige que no llegue a `state.matches`.

**REQUIERE INTERVENCIÓN DE TOMÁS:** sacar #63 de Draft. No crear otro PR equivalente.

### #32 / #35 — modelar sanciones administrativas y no-presentaciones

**Estado:** BLOQUEADO POR STAGING/DECISIÓN DE MODELO.

No inferir sanciones desde marcador, fixture o ausencia de planilla.

### #36 / #37 — reducir privilegios SQL destructivos

**Estado:** BLOQUEADO POR STAGING.

Falta probar CRUD legítimo, Security Advisor e integrity report en una base no productiva antes de cualquier migración.

### #38 / #39 — endurecer integrity_report_7metros

**Estado:** BLOQUEADO POR STAGING.

El contrato estático y la regresión del falso negativo scoped están implementados y CI pasa. Falta comportamiento SQL real contra Supabase staging/development y advisors antes de promoverlo.

## MEDIO

### Documentación de auditoría

**Estado:** sincronización preparada en la rama `chore/sync-auditor-backlog-2026-10-08`.

Este cambio actualiza el SHA real de `main`, separa evidencia de hipótesis y evita afirmar que Pages/rulesets están comprobados cuando no lo están en esta ejecución.

### Metadatos incompletos de clubes

**Estado:** PENDIENTE.

Completar sólo con fuentes verificables y sin inventar logos, abreviaturas o ciudades.

### IDs propios de rosters/participaciones

**Estado:** HIPÓTESIS DE ROBUSTEZ.

`store.js` convierte sus IDs con `Number()` sin guard propio, pero las relaciones estadísticas actuales se basan principalmente en jugador/equipo/partido. Antes de crear otro PR hay que demostrar un consumidor que dependa de esos IDs o añadir una regresión que justifique el guard.

### #57 — trazabilidad programación/planilla

**Estado:** separado del frente FEMEBAL/n8n SAFE. No modificar desde este auditor general.

## BAJO

- Limpieza de ramas históricas.
- Visuales secundarios.
- Optimizaciones sin cuello de botella reproducible.

## PRs abiertos que NO deben consolidarse desde este auditor

- PR #34: FEMEBAL Community/n8n SAFE/DRY RUN; mantener separado.
- PR #43: IA; mantener aislado hasta disponer de GT suficiente para pelota/posesión/eventos.
- PR #35, #37 y #39: mantener en Draft hasta staging/evidencia real.
- PR #63: listo técnicamente, pero no consolidar mientras siga Draft.

## REQUIERE INTERVENCIÓN DE TOMÁS

1. Sacar PR #63 de Draft.
2. Proporcionar una Supabase development branch/staging para desbloquear #35/#37/#39.
3. Si se requiere confirmar/corregir settings administrativos de GitHub relacionados con #64, hacerlo con acceso/configuración del propietario; este auditor no debe cambiar reglas de protección sin evidencia y decisión explícita.

## Próximas prioridades autónomas

1. Consolidar #63 una vez que deje de ser Draft y verificar el nuevo `main`.
2. Cerrar #58 sólo después de validar el post-merge.
3. Verificar Pages públicamente con evidencia reproducible.
4. Mantener #39/#37/#35 bloqueados hasta staging.
5. Auditar exactitud de estadísticas, scope y carga sobre el `main` consolidado.
6. Investigar IDs propios de rosters/participaciones sólo con una regresión o consumidor real que demuestre impacto.
