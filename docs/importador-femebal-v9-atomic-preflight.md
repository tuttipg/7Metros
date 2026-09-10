# Importador FEMEBAL V9 · preflight atómico

Fecha: 2026-09-10

Este documento complementa `importador-femebal-v9-rpc-contract.md`.

## Invariante nueva

`sync_partidos_7metros_bulk` ejecuta `importador_preflight_partidos_7metros` dentro del propio RPC antes de iniciar la sincronización. El workflow n8n debe seguir ejecutando el preflight explícitamente para poder mostrar un diagnóstico legible, pero la base ya no confía en que ese paso externo haya ocurrido.

Si `ok != true`, el RPC de escritura lanza una excepción antes de llamar a la implementación interna y, por lo tanto, no puede producir una importación parcialmente válida por un error estructural del lote.

## Lote ya priorizado

El lote que llega a escritura debe contener como máximo una programación distinta por combinación direccional:

`temporada_id + local_equipo_id + visitante_equipo_id`

Por eso el preflight rechaza también un lote que contenga simultáneamente una fecha normal y una reprogramación distinta del mismo cruce. La priorización debe haberse resuelto antes, usando la lógica testeable de `n8n/importer-core.mjs`.

Esto evita que el orden de los items del array determine accidentalmente cuál fecha termina guardada.

## Compatibilidad con V8.2

V8.2 ya agrupa y prioriza antes del nodo de sincronización y usa lotes de 50. Los nuevos límites mantienen ese contrato, pero bloquean un lote si llega sin priorizar o si supera 200 items.

## Permisos

La interfaz pública `sync_partidos_7metros_bulk(jsonb)` continúa disponible exclusivamente para `service_role`. La implementación interna `sync_partidos_7metros_bulk_impl_v2(jsonb)` tampoco es ejecutable por `anon` ni por `authenticated`.

## Verificación productiva

Después de aplicar la migración:

- un partido real existente pasó el preflight;
- un lote con el mismo cruce y dos horarios distintos fue rechazado con `ambiguous_schedule_pairs = 1`;
- `integrity_report_7metros(3)` continuó en `ok = true`;
- se conservaron los 2.689 partidos;
- `anon` y `authenticated` no obtuvieron permiso de ejecución sobre el RPC público.
