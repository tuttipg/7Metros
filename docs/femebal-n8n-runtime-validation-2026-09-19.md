# FEMEBAL / n8n SAFE runtime validation — 2026-09-19

Evidencia manual de ejecución en la instancia n8n Cloud real del proyecto. Esta validación se realizó en modo SAFE/DRY RUN, sin credenciales FEMEBAL, sin nodos Supabase y sin escrituras productivas.

## Caso control

Planilla oficial conocida:

- fecha: 2026-03-21;
- hora: 20:15;
- categoría/división: Mayores — LHC Hipotecario Seguros;
- local: Argentinos Juniors;
- visitante: Ferro Carril Oeste;
- marcador: 20–27;
- fuente: `https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf`.

La planilla se mantiene conceptualmente como `known_test_fixture`: esta validación runtime no cambia su estado de descubrimiento público.

## Runtime comprobado

Se ejecutaron manualmente workflows SAFE derivados del contrato del PR #34 y se comprobó:

1. GET anónimo de la planilla oficial con `Accept: application/pdf`;
2. descarga como binario sin autenticación;
3. extracción mediante el nodo core `Extract From File` / PDF;
4. SHA-256 calculado sobre el binario;
5. creación y preservación de envelope SAFE con `correlation_id=sha256`;
6. bifurcación binario/envelope y rejoin;
7. conservación de correlación SHA-256 después de la extracción;
8. parseo de fecha, hora, categoría, división, equipos y marcador;
9. cierre exacto de goles de jugadores contra el 20–27;
10. gate pre-Supabase;
11. construcción de preview no ejecutable;
12. validación de decisiones de idempotencia.

La extracción real produjo texto utilizable en n8n y el parser llegó al resultado esperado del partido control.

## Contrato SAFE observado al final

La salida de preproducción mantuvo simultáneamente:

- `safe=true`;
- `dry_run=true`;
- `write_enabled=false`;
- `production_write_allowed=false`;
- `executable_request=false`;
- `target=null`;
- `operation=preview_only`.

No se usaron nodos de base de datos, RPC, persistencia ni escritura.

## Idempotencia comprobada

El gate de decisión se ejecutó con asserts runtime para tres ramas:

- coincidencia exacta existente → `no_op_existing_exact_match`, sin insert ni update;
- lookup controlado vacío → `candidate_insert_preview`, con `would_insert=true` solamente como preview no ejecutable;
- fila existente conflictiva → `conflict_existing_mismatch`, sin insert ni update y fail-closed para revisión manual.

La rama de lookup vacío es un fixture controlado del gate; no afirma que un partido real específico falte en producción.

## Verificación read-only contra Supabase

Una consulta de sólo lectura comprobó que el partido control ya existe en producción:

- `partido_id=2821`;
- `temporada_id=4` — Apertura 2026;
- Argentinos Juniors: `equipo_id=1205`;
- Ferro Carril Oeste: `equipo_id=1206`;
- marcador: 20–27;
- misma `planilla_url`;
- 32 participaciones;
- 47 goles;
- 4 exclusiones de 2 minutos;
- 1 tarjeta roja.

Por lo tanto, para este caso real la decisión correcta es no-op.

### Importante: IDs de regresión vs. producción

Los mappings usados en smokes unitarios del repositorio (por ejemplo `3/1`) son fixtures de test y **no deben interpretarse como IDs productivos**. Los IDs de equipo son dependientes del modelo/temporada cargada. Cualquier futuro payload productivo debe resolver y validar el mapping contra el scope real antes de persistir.

## Alcance de la evidencia

Esta prueba confirma compatibilidad runtime del patrón usado por el pipeline en la instancia n8n Cloud real: descarga, binario, `Extract From File`, SHA-256, envelope/rejoin, parser, gate de preproducción e idempotencia.

No habilita escrituras ni convierte el PR en un importador productivo. Antes de cualquier persistencia siguen siendo obligatorios un contrato explícito de escritura, resolución de scope/IDs en runtime, idempotencia contra datos actuales y una promoción deliberada fuera de DRY RUN.
