# 7Metros

**Estadísticas · Análisis · Rendimiento para handball argentino.**

7Metros es un portal web independiente para organizar resultados, planteles, jugadores y estadísticas del handball argentino. La versión actual mantiene la identidad visual azul oscuro, dorado, fondo parquet y marca 7M, y está preparada para crecer hacia perfiles deportivos, análisis de video e inteligencia artificial.

## Estado actual

- Frontend estático compatible con GitHub Pages.
- Datos leídos desde Supabase/Postgres mediante la API REST.
- Filtros dependientes en orden **rama → categoría → división**.
- Categorías ordenadas como Infantiles, Menores, Cadetes, Juveniles, Juniors y Mayores.
- Temporada actual centralizada en `config.js`.
- Sitio público en modo de solo lectura.
- Exportación CSV.
- Escudos de clubes leídos desde `clubes.logo_url`, con fallback automático por iniciales.
- Inicio sin filtros globales: los KPI muestran la base completa y la portada deportiva prioriza LHC/LHD.
- Arquitectura preparada para sumar eventos de video/IA sin inventar métricas que todavía no existen.
- Importador FEMEBAL auditado con política fail-closed e idempotencia como requisito operativo.

## Secciones

- `index.html` — dashboard general; KPI globales y portada LHC/LHD.
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
7Metros/
├── README.md
├── config.js
├── api.js
├── store.js
├── ui.js
├── pages.js
├── utils.js
├── script.js
├── style.css
├── store-smoke.mjs
├── validate_site.py
├── supabase_integrity_check.sql
├── docs/
│   └── importador-femebal-v8.2-audit.md
├── favicon.svg
├── arco-handball.jpeg
└── *.html
```

### Responsabilidades

- `config.js`: configuración pública del frontend.
- `api.js`: acceso paginado y conteos REST de Supabase.
- `store.js`: normalización, índices, filtros y cálculos deportivos.
- `pages.js`: renderizado específico de cada página.
- `ui.js`: navegación, escudos, filtros globales, búsqueda, ajustes y reportes.
- `utils.js`: fechas, seguridad de texto/URLs, CSV y utilidades.
- `script.js`: arranque robusto de la aplicación y shell de respaldo.
- `supabase_integrity_check.sql`: controles no destructivos para detectar duplicados, referencias rotas y partidos fuera de scope.
- `docs/importador-femebal-v8.2-audit.md`: auditoría técnica y contrato recomendado para la evolución del importador.

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

La clave publishable puede estar en un frontend público, pero **RLS debe proteger todas las operaciones**. El frontend solo realiza lecturas.

## Datos esperados

La versión actual utiliza las tablas:

- `clubes`
- `equipos`
- `jugadores`
- `planteles`
- `partidos`
- `participaciones`

Para clubes, el frontend aprovecha además:

- `abreviatura`
- `ciudad`
- `logo_url`

Si `logo_url` está vacío o la imagen externa falla, la interfaz conserva las iniciales del club como fallback.

## Principio de calidad de datos

7Metros no interpreta un dato ausente como `0`. Por ejemplo, si las participaciones actuales no contienen asistencias o lanzamientos, la web no presenta una efectividad ficticia del 0%.

Los partidos con estado `programado` tampoco se consideran resultados aunque la base contenga placeholders de marcador.

El importador debe ser idempotente: ejecutar dos veces la misma fuente no puede duplicar clubes, equipos ni partidos. Ante una ambigüedad, la escritura debe bloquearse o pasar a revisión; nunca se debe completar información por adivinación.

## Importador FEMEBAL

La auditoría del workflow V8.2 está documentada en `docs/importador-femebal-v8.2-audit.md`. La rama general del importador valida cobertura de clubes, IDs de equipos, reprogramaciones y volumen antes de escribir en Supabase.

Antes y después de una importación importante se recomienda ejecutar `supabase_integrity_check.sql`. El resultado esperado para los controles críticos es cero en:

- grupos de clubes duplicados;
- grupos de equipos duplicados;
- partidos exactamente duplicados;
- referencias de equipos rotas;
- partidos entre equipos de distinto scope competitivo;
- partidos con el mismo equipo como local y visitante.

## Tests

Desde la raíz del repositorio:

```bash
node store-smoke.mjs
python validate_site.py
```

Los tests incluidos comprueban:

- carga del dataset;
- metadatos de escudos;
- filtros;
- puntos/posiciones;
- goles y participaciones;
- ausencia de estadísticas inventadas;
- enlaces locales;
- páginas faltantes;
- textos obsoletos.

GitHub Actions ejecuta automáticamente estas validaciones en cada push a `main` y en pull requests.

## Escudos

Los escudos no están hardcodeados en la interfaz. La fuente es `public.clubes.logo_url` en Supabase. Esto permite corregir o agregar un escudo sin modificar HTML ni JavaScript.

La función común `clubBadge()` se reutiliza en inicio, posiciones, partidos, clubes, fichas y búsqueda.

## Nota institucional

7Metros es un proyecto independiente y no representa oficialmente a Fe.Me.Bal. La fuente competitiva prioritaria del proyecto es la información oficial de FEMEBAL.
