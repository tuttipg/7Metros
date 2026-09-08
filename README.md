# 7Metros

**Estadísticas · Análisis · Rendimiento para handball argentino.**

7Metros es un portal web independiente para organizar resultados, planteles, jugadores y estadísticas del handball argentino. La versión V2 mantiene la identidad visual original —azul oscuro, dorado, fondo parquet y marca 7M— y reorganiza el proyecto para que pueda crecer hacia perfiles deportivos, análisis de video e inteligencia artificial.

## Estado actual

- Frontend estático compatible con GitHub Pages.
- Datos leídos desde Supabase/Postgres mediante la API REST.
- Filtros por categoría, división y rama.
- Temporada actual centralizada en `config.js`.
- Sitio público en modo de solo lectura.
- Exportación CSV.
- Arquitectura preparada para sumar eventos de video/IA sin inventar métricas que todavía no existen.

## Secciones

- `index.html` — dashboard y resumen de competencia.
- `posiciones.html` — tabla calculada por resultados cargados.
- `partidos.html` — calendario y resultados.
- `partido.html` — detalle de partido, participaciones y fuentes.
- `clubes.html` / `club.html` — clubes, forma, balance, goleadores y plantel.
- `jugadores.html` / `jugador.html` — buscador y perfiles individuales.
- `planteles.html` — planteles por posición.
- `participaciones.html` — resumen acumulado desde planillas.
- `estadisticas.html` — líderes, promedio de gol y balance por club.
- `reportes.html` — exportaciones CSV.
- `ajustes.html` — preferencias locales.
- `acerca-de.html` — misión, fuente y roadmap.

## Estructura técnica

```text
7Metros-V2/
├── config.js
├── script.js
├── style.css
├── favicon.svg
├── arco-handball.jpeg
├── *.html
├── js/
│   ├── api.js
│   ├── config.js
│   ├── pages.js
│   ├── store.js
│   ├── ui.js
│   └── utils.js
├── docs/
└── tests/
```

### Responsabilidades

- `config.js`: configuración editable sin tocar la lógica.
- `js/api.js`: acceso paginado a Supabase.
- `js/store.js`: normalización, índices, filtros y cálculos deportivos.
- `js/pages.js`: renderizado específico de cada página.
- `js/ui.js`: navegación, filtros globales, búsqueda, ajustes y reportes.
- `js/utils.js`: fechas, seguridad de texto/URLs, CSV y utilidades.
- `script.js`: arranque de la aplicación.

## Ejecutar localmente

Por usar módulos ES, conviene servir el proyecto por HTTP:

```bash
python -m http.server 8000
```

Luego abrir:

```text
http://localhost:8000
```

No se recomienda abrir los HTML directamente con `file://`.

## Configuración de Supabase

La configuración pública está en `config.js`:

```js
supabaseUrl: 'https://...supabase.co',
supabaseKey: 'sb_publishable_...',
seasonId: 3,
seasonLabel: 'CLAUSURA 2026'
```

La clave publishable puede estar en un frontend público, pero **RLS debe proteger todas las operaciones**. El frontend V2 solo realiza lecturas.

## Datos esperados

La versión actual utiliza las tablas existentes:

- `clubes`
- `equipos`
- `jugadores`
- `planteles`
- `partidos`
- `participaciones`

El código tolera algunos nombres alternativos para enlaces de planilla/video y futuras métricas.

## Principio de calidad de datos

7Metros V2 no interpreta un dato ausente como `0`. Por ejemplo, si las participaciones actuales no contienen asistencias o lanzamientos, la web no presenta una efectividad ficticia del 0%.

## Tests

```bash
node tests/store-smoke.mjs
python tests/validate_site.py
```

Los tests incluidos comprueban:

- carga del dataset;
- filtros;
- puntos/posiciones;
- goles y participaciones;
- ausencia de estadísticas inventadas;
- enlaces locales;
- páginas faltantes;
- textos obsoletos de Apertura/Flask/SQLite.

## Documentación

- [`docs/CAMBIOS_V2.md`](docs/CAMBIOS_V2.md)
- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- [`docs/APLICAR_MEJORAS.md`](docs/APLICAR_MEJORAS.md)
- [`docs/COMPARATIVA.md`](docs/COMPARATIVA.md)
- [`docs/INTEGRACION_IA_Y_DATOS.md`](docs/INTEGRACION_IA_Y_DATOS.md)

## Nota institucional

7Metros es un proyecto independiente y no representa oficialmente a Fe.Me.Bal. El sitio oficial de la Federación Metropolitana de Balonmano es https://femebal.com/.
