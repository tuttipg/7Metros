# Operación y uso de 7Metros

## Abrir el sitio

El frontend no requiere build: es HTML/CSS/JavaScript estático. Debe servirse por HTTP (no `file://`) porque usa ES modules. GitHub Pages u otro hosting estático es suficiente.

## Navegación pública

- **Inicio**: escala global de la base; resultados/calendario/posiciones destacados de LHC + LHD; todos los clubes.
- **Competiciones**: selector por rama, categoría y división.
- **Posiciones**: tabla derivada de resultados.
- **Partidos**: fixture y resultados del filtro elegido.
- **Clubes / Jugadores / Planteles**: perfiles y directorios.
- **Estadísticas**: rankings y métricas disponibles.
- **Cobertura**: indica qué existe realmente en cada capa.
- **Comparar**: contraste entre equipos y jugadores cuando hay datos.
- **IA / Video**: estado y arquitectura de la analítica automática.

## Administración

Abrir `admin.html` e iniciar sesión con una cuenta existente en Supabase Auth que tenga un registro activo en `perfiles` con rol permitido.

El panel ofrece:
- indicadores de calidad;
- revisiones de importación;
- jobs de IA;
- editor JSON avanzado para recursos permitidos.

Las operaciones del panel están limitadas por RLS. No se debe agregar una service key a ningún archivo del frontend.

## Importar datos

Requisitos:

```bash
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements-tools.txt
```

Variables privadas para ejecución backend/CLI:

```text
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<solo-en-entorno-seguro>
```

Validar primero en dry-run. Nunca poner `SUPABASE_SERVICE_ROLE_KEY` en Git, HTML, JavaScript cliente ni capturas públicas.

## Validaciones del repositorio

```bash
node --check api.js
node --check store.js
node --check ui.js
node --check pages.js
node --check features.js
node --check autonomous.js
node --check admin.js
node --check script.js
node store-smoke.mjs
python validate_site.py
python -m py_compile tools/femebal_importer.py ai/pipeline.py ai/evaluate.py
```

GitHub Actions ejecuta estas validaciones en cada PR.

## Agregar una nueva competencia

No se agrega al frontend manualmente. Crear/importar los `equipos` correctos para temporada, rama, categoría y división. Los filtros y el directorio se derivan de la base.

## Agregar un club

Preferir importador o panel admin. El nombre debe ser único. Luego crear sus equipos por temporada. El escudo puede quedar pendiente: la UI usa fallback sin inventar un logo.

## Agregar resultados

Actualizar `partidos.goles_local`, `partidos.goles_visitante` y estado de acuerdo con la fuente oficial. Al existir resultado, posiciones, goles agregados y balances se recalculan automáticamente.

## Agregar jugadores y planillas

1. Resolver identidad del jugador o alias.
2. Crear/actualizar `jugadores`.
3. Vincular a `planteles` por `equipo_id`.
4. Crear `participaciones` por partido.
5. Cargar eventos detallados solo si la fuente los soporta.

## IA / video

1. Vincular video en `videos_partidos`.
2. Crear `ai_jobs`.
3. Ejecutar pipeline fuera del navegador.
4. Guardar detecciones/eventos en `ai_eventos` con confianza y timestamp.
5. Revisar eventos.
6. Publicar únicamente eventos revisados.

## Recuperación ante errores

- Si falla Supabase, la navegación estática debe seguir visible.
- Si una importación es ambigua, enviar el registro a `import_revision` en lugar de adivinar.
- Si un logo falla, mantener fallback textual.
- Si una estadística no tiene datos, mostrar estado vacío.
