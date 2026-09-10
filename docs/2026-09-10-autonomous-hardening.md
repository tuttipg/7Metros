# Auditoría autónoma · 2026-09-10

## Cambios aplicados en Supabase

- `sync_equipo_7metros` pasó a política fail-closed para clubes desconocidos: no crea entidades canónicas por inferencia.
- El trigger de `partidos` también valida `competencia_id` contra la competencia de la temporada.
- Se agregó `importador_preflight_partidos_7metros`, RPC de solo lectura para validar lotes antes de escribir.
- `sync_partidos_7metros_bulk` exige contexto explícito, trazabilidad FEMEBAL y lotes de hasta 200 partidos.
- `integrity_report_7metros` amplió controles de competencia/temporada, marcadores y tipos de fuente.

## Verificaciones en producción

Después de las migraciones:

- integridad de temporada 3: `ok = true`;
- 2.689 partidos conservados;
- 0 duplicados de clubes/equipos/partidos;
- 0 referencias de equipos rotas;
- 0 cruces entre scopes;
- 0 local = visitante;
- 0 partidos sin trazabilidad de fuente;
- 0 incompatibilidades competencia/temporada;
- 0 marcadores parciales;
- 0 programados con marcador;
- 0 finalizados sin marcador;
- 0 tipos de fuente desconocidos;
- 0 revisiones pendientes después del hardening;
- Supabase Security Advisor: 0 alertas.

El preflight fue probado con un partido real existente y devolvió `ok = true`. También se probó una entrada inválida con local = visitante y devolvió `ok = false` sin escribir datos.

## Hallazgo del importador V8.2

El dataset actual contiene 453 pares de clubes que se enfrentan en más de un scope competitivo, con hasta 12 scopes para un mismo par. Por eso una clave basada solamente en nombres de club local/visitante no es segura.

Se agregó `n8n/importer-core.mjs` como referencia ejecutable para V9. Prioriza por `equipo_id` cuando está disponible y, antes de resolver IDs, utiliza rama + categoría + división + club + código A/B/C/D.

## Web

`api.js` usa `v_global_summary` para los KPI globales y solicita partidos por temporada. Mantiene un fallback para instalaciones anteriores, evitando una dependencia rígida de la vista.

## Pendiente externo

El workflow n8n vivo no fue modificado porque no hay conexión n8n disponible desde esta ejecución. El repositorio contiene el contrato, la implementación de referencia y pruebas para trasladar la lógica de forma segura al workflow cuando exista acceso.
