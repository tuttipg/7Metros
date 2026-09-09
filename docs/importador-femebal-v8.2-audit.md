# Auditoría del importador FEMEBAL V8.2

Fecha de revisión: 2026-09-09.

## Alcance

Esta auditoría toma como referencia el workflow `7Metros - Importador FEMEBAL V8.2` exportado desde n8n y lo contrasta con el estado real de Supabase.

## Estado validado

- El workflow contiene una rama general para todas las categorías metropolitanas y una rama histórica específica de LHC.
- La rama general detecta rama, categoría, división, local, visitante y código de equipo; luego sincroniza clubes/equipos y finalmente partidos por lotes.
- La escritura general queda bloqueada si la cobertura de identificación no alcanza 100% o existen partidos sin `equipo_id` válido.
- Supabase contiene 107 clubes, 1.152 equipos y 2.689 partidos de Clausura 2026.
- Se verificó: 0 grupos de clubes duplicados, 0 grupos de equipos duplicados, 0 grupos de partidos exactamente duplicados, 0 referencias de equipo rotas y 0 partidos cruzando categorías/divisiones incompatibles.
- `club_aliases` cubre los 107 clubes y mantiene 120 aliases activos.

## Fortalezas de V8.2

1. Prioriza reprogramaciones sobre programación normal.
2. Impide escribir partidos con IDs nulos, negativos o iguales entre local y visitante.
3. Separa equipos A/B/C/D mediante `equipo_codigo`.
4. Sincroniza clubes/equipos antes de resolver IDs de partidos.
5. Usa lotes para evitar payloads excesivos.
6. Guarda trazabilidad de programación (`programacion_url`, `programacion_pdf_url`, `tipo_fuente`).
7. La RPC de partidos deriva casos ambiguos a `import_revision` en vez de modificar partidos finalizados automáticamente.

## Riesgos detectados

### 1. Alias duplicados entre n8n y Supabase

El nodo `07G` mantiene una lista manual extensa de nombres y variantes, mientras Supabase ya dispone de `club_aliases`. Mantener ambas fuentes puede generar divergencias. La evolución recomendada para V9 es consultar el catálogo/aliases desde Supabase y mantener en n8n solo un fallback mínimo y explícito.

### 2. Rama LHC heredada

Los nodos `07`, `08`, `08B`, `09`, `15`-`22` siguen ejecutando lecturas y comparaciones de LHC aunque las escrituras históricas estén deshabilitadas. La rama general ya cubre LHC. Conviene retirar esta rama del camino principal o convertirla en un test diagnóstico separado para reducir tiempo, tráfico y superficie de mantenimiento.

### 3. Límites fijos de volumen

El nodo `34` exige entre 2.600 y 2.732 fixtures. Es una protección útil para Clausura 2026, pero se volverá frágil al reutilizar el workflow en otra fase/temporada. V9 debería parametrizar temporada y límites esperados, o validar contra un baseline de la propia temporada.

### 4. IDs fijos de competencia/temporada

V8.2 utiliza `competencia_id = 3` y `temporada_id = 3` en varios nodos. Para una automatización sostenible, ambos valores deben resolverse por configuración o por consulta a Supabase.

### 5. Dependencia de scraping de texto PDF

La detección usa expresiones regulares sobre texto extraído. Es correcto mantener una política fail-closed: cualquier formato nuevo no reconocido debe ir a revisión y nunca producir una escritura silenciosa.

## Contrato recomendado para V9

Antes de escribir en Supabase, V9 debería comprobar siempre:

- temporada y competencia resueltas de forma explícita;
- cobertura de identificación de clubes = 100%;
- 0 partidos con IDs inválidos;
- 0 local = visitante;
- 0 duplicados exactos en el lote;
- 0 cruces entre equipos de distinto scope competitivo;
- aliases obtenidos prioritariamente desde Supabase;
- reprogramaciones aplicadas solo a partidos en estado `programado`;
- partidos finalizados divergentes enviados a `import_revision`;
- resumen final de insertados, existentes, reprogramados, revisión y errores.

## Regla operativa

El importador debe ser idempotente: ejecutarlo dos veces sobre la misma fuente no debe duplicar clubes, equipos ni partidos. Ante ambigüedad debe detener la escritura o registrar revisión, nunca adivinar.
