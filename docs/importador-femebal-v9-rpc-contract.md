# Contrato RPC para Importador FEMEBAL V9

Fecha: 2026-09-09

## Objetivo

Eliminar dos fuentes de fragilidad de V8.2: IDs de temporada/competencia hardcodeados y aliases de clubes duplicados entre n8n y Supabase.

## RPC 1: `importador_contexto_7metros`

Endpoint REST:

`POST /rest/v1/rpc/importador_contexto_7metros`

Body:

```json
{
  "p_temporada_id": 3
}
```

Respuesta esperada:

```json
{
  "temporada_id": 3,
  "temporada_nombre": "Clausura 2026",
  "anio": 2026,
  "fase": "Clausura",
  "competencia_id": 3,
  "fecha_inicio": null,
  "fecha_fin": null,
  "clubes_activos": 107,
  "equipos_activos_temporada": 1152,
  "partidos_temporada": 2689,
  "aliases_activos": 120
}
```

Uso recomendado en n8n:

1. Ejecutar al inicio del workflow.
2. Guardar `temporada_id` y `competencia_id` como contexto de ejecución.
3. Reemplazar todos los valores literales `3` de los nodos de sincronización por estos valores.
4. Usar los contadores solo como observabilidad/baseline, no como verdad del fixture nuevo.
5. Si la RPC devuelve `null`, bloquear la ejecución antes de descargar/escribir datos.

## RPC 2: `catalogo_aliases_7metros`

Endpoint REST:

`POST /rest/v1/rpc/catalogo_aliases_7metros`

Body: `{}`

Devuelve un array con:

```json
[
  {
    "club_id": 1,
    "club_nombre": "Nombre canónico",
    "alias": "Variante FEMEBAL",
    "alias_normalizado": "variante femebal",
    "fuente": "importador_femebal"
  }
]
```

Uso recomendado en V9:

1. Cargar esta RPC antes del nodo que identifica local/visitante.
2. Ordenar aliases por longitud descendente antes de hacer matching.
3. Usar `club_nombre` como nombre canónico de salida.
4. Mantener en n8n únicamente aliases de emergencia no persistidos todavía.
5. Si aparece un alias nuevo confirmado, persistirlo en `club_aliases` y dejar de mantenerlo en código.
6. Nunca resolver por coincidencia parcial ambigua; mandar el caso a revisión.

## Seguridad

Ambas RPC son `SECURITY DEFINER`, tienen `search_path = public` y solo pueden ser ejecutadas por `service_role`.

Verificado:

- `anon`: sin EXECUTE.
- `authenticated`: sin EXECUTE.
- `service_role`: con EXECUTE.
- Supabase Security Advisor: 0 alertas luego de la migración.

## Regla para V9

El orden de inicialización debería ser:

1. Resolver contexto de temporada.
2. Obtener catálogo de aliases.
3. Descargar fuentes FEMEBAL.
4. Extraer fixtures.
5. Identificar clubes/equipos.
6. Validar cobertura 100%.
7. Sincronizar clubes/equipos.
8. Obtener catálogo de `equipo_id`.
9. Resolver IDs de partidos.
10. Priorizar reprogramaciones.
11. Ejecutar validaciones fail-closed.
12. Sincronizar partidos por lotes.
13. Emitir resumen final e integridad post-importación.

## Invariantes

V9 no debe escribir si ocurre cualquiera de estos casos:

- temporada inexistente;
- club no identificado;
- `equipo_id` faltante;
- local = visitante;
- cruce ambiguo;
- partido de equipos de distinto scope competitivo;
- más de una reprogramación del mismo cruce sin criterio inequívoco;
- modificación de partido finalizado por una programación divergente.

La regla central sigue siendo idempotencia y política fail-closed: ante ambigüedad, registrar revisión o detener la escritura; nunca adivinar.
