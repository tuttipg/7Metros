# Contrato RPC para Importador FEMEBAL V9

Fecha: 2026-09-10

## Objetivo

Eliminar las fuentes de fragilidad detectadas en V8.2: IDs de temporada/competencia hardcodeados, aliases duplicados entre n8n y Supabase, agrupación de cruces sin scope deportivo completo y escritura antes de un preflight reproducible.

La política es **fail-closed**: ante una identidad o programación ambigua, no se modifica `partidos`.

## RPC 1: `importador_contexto_7metros`

Endpoint REST:

`POST /rest/v1/rpc/importador_contexto_7metros`

Body:

```json
{
  "p_temporada_id": 3
}
```

Uso recomendado en n8n:

1. Ejecutar al inicio del workflow.
2. Guardar `temporada_id` y `competencia_id` como contexto de ejecución.
3. Reemplazar valores literales de temporada/competencia en los nodos de sincronización por este contexto.
4. Usar los contadores solo como observabilidad/baseline, nunca como una regla fija de cantidad de fixtures.
5. Si la RPC no devuelve una temporada válida, bloquear la ejecución antes de descargar/escribir datos.

## RPC 2: `catalogo_aliases_7metros`

Endpoint REST:

`POST /rest/v1/rpc/catalogo_aliases_7metros`

Body: `{}`

Devuelve `club_id`, nombre canónico, alias, alias normalizado y fuente.

Reglas:

1. Cargar esta RPC antes de identificar local/visitante.
2. Ordenar aliases por longitud descendente antes de hacer matching.
3. Usar `club_nombre` como nombre canónico de salida.
4. Mantener en n8n únicamente aliases de emergencia que todavía no estén confirmados.
5. Nunca resolver por coincidencia parcial ambigua.
6. `sync_equipo_7metros` ya no crea clubes desconocidos: un nombre nuevo debe resolverse contra un club existente o un alias confirmado.

## RPC 3: `catalogo_equipos_7metros`

Debe ejecutarse después de sincronizar los equipos conocidos y antes de priorizar reprogramaciones.

La identidad deportiva de un equipo está formada por:

- `temporada_id`;
- `club_id`;
- `categoria`;
- `division`;
- `rama`;
- `equipo_codigo`.

El workflow debe resolver `local_equipo_id` y `visitante_equipo_id` antes de decidir si dos publicaciones corresponden al mismo partido.

## Regla crítica de scope

**Nunca agrupar un cruce únicamente por nombre de club local + visitante.**

El mismo par de clubes puede enfrentarse simultáneamente en Infantiles, Menores, Cadetes, Juveniles, Juniors, Mayores, distintas divisiones, ramas y equipos B/C/D.

Antes de tener IDs, la clave mínima debe incluir:

`rama + categoria + division + local + local_equipo_codigo + visitante + visitante_equipo_codigo`

Después de resolver IDs, la clave preferida es:

`local_equipo_id + visitante_equipo_id`

La implementación de referencia testeable está en `n8n/importer-core.mjs` y su regresión en `n8n/importer-core-smoke.mjs`.

## RPC 4: `importador_preflight_partidos_7metros`

Endpoint REST:

`POST /rest/v1/rpc/importador_preflight_partidos_7metros`

Body:

```json
{
  "p_partidos": [
    {
      "temporada_id": 3,
      "competencia_id": 3,
      "fecha": "2026-09-10",
      "hora": "20:00",
      "local_equipo_id": 123,
      "visitante_equipo_id": 456,
      "programacion_url": "https://femebal.com/...",
      "programacion_pdf_url": "https://femebal.com/...pdf",
      "tipo_fuente": "fecha_normal"
    }
  ]
}
```

Es una validación de solo lectura. Debe devolver `ok = true` antes de llamar al RPC de escritura.

Comprueba, entre otras cosas:

- contexto explícito de temporada y competencia;
- correspondencia competencia ↔ temporada;
- IDs de equipos positivos y distintos;
- existencia de los equipos;
- misma temporada;
- misma categoría, división y rama;
- fecha válida;
- trazabilidad de URL y PDF;
- `tipo_fuente` permitido;
- duplicados dentro del payload;
- más de una programación distinta sin una única reprogramación inequívoca.

## RPC 5: `sync_partidos_7metros_bulk`

V9 debe invocarlo **solo después de un preflight exitoso**.

El RPC de escritura ahora exige explícitamente `temporada_id`, `competencia_id`, `programacion_url`, `programacion_pdf_url` y `tipo_fuente`. Ya no utiliza `3` como fallback silencioso.

Además limita cada lote a 200 partidos. El workflow actual utiliza lotes de 50, por lo que conserva compatibilidad.

Comportamiento:

- partido inexistente y válido → inserción;
- partido idéntico → refresco de trazabilidad;
- partido `programado` con una reprogramación inequívoca → actualización de fecha/hora;
- partido ya no programado con fecha divergente → `import_revision`;
- cruce ambiguo → `import_revision`;
- dato inválido → no modifica `partidos`.

## Integridad post-importación

Al finalizar, ejecutar `integrity_report_7metros(temporada_id)`.

`ok` solo puede ser verdadero si, entre otros controles, existen:

- 0 clubes/equipos/partidos duplicados;
- 0 referencias rotas;
- 0 cruces entre scopes;
- 0 local = visitante;
- 0 partidos sin trazabilidad;
- 0 competencia/temporada incompatibles;
- 0 marcadores parciales;
- 0 partidos programados con marcador;
- 0 finalizados sin marcador;
- 0 tipos de fuente desconocidos;
- cobertura de aliases para todos los clubes activos.

## Seguridad

Los RPC de contexto, catálogo, preflight, sincronización e integridad son de uso de backend/importador y deben permanecer ejecutables por `service_role`, no por `anon` ni por usuarios autenticados normales.

Supabase RLS continúa siendo la última barrera de autorización para operaciones ordinarias.

## Orden recomendado V9

1. Resolver contexto de temporada.
2. Obtener catálogo de aliases.
3. Descargar fuentes FEMEBAL.
4. Extraer fixtures.
5. Identificar clubes con política fail-closed.
6. Validar cobertura de identificación.
7. Sincronizar solo equipos de clubes ya conocidos.
8. Obtener catálogo de `equipo_id`.
9. Resolver IDs de todos los partidos.
10. Priorizar reprogramaciones usando scope/IDs, nunca solo nombres de club.
11. Ejecutar `importador_preflight_partidos_7metros`.
12. Si `ok !== true`, detener la escritura y emitir diagnóstico.
13. Sincronizar partidos por lotes con `sync_partidos_7metros_bulk`.
14. Ejecutar `integrity_report_7metros`.
15. Registrar resumen de ejecución y métricas.

## Invariantes

V9 no debe escribir en `partidos` si ocurre cualquiera de estos casos:

- temporada inexistente o implícita;
- competencia incompatible con la temporada;
- club no identificado;
- `equipo_id` faltante/inactivo;
- local = visitante;
- cruce ambiguo;
- equipos de distinto scope competitivo;
- más de una reprogramación sin criterio inequívoco;
- falta de trazabilidad a página/PDF FEMEBAL;
- intento de modificar automáticamente un partido finalizado con programación divergente.

Los límites fijos de cantidad de fixtures de V8.2 son útiles como alerta histórica, pero no deben actuar como contrato universal de V9. El baseline debe derivarse del contexto de temporada y de verificaciones de integridad, no de números hardcodeados.
