# 7Metros

**Estadísticas · Análisis · Rendimiento para handball argentino.**

7Metros es una plataforma independiente para transformar fixture, planillas, video y eventos del handball argentino en información navegable y trazable. El foco inicial es FEMEBAL y la arquitectura está preparada para crecer desde estadísticas públicas hacia scouting y visión por computadora.

## Estado al 9 de septiembre de 2026

- Frontend estático compatible con GitHub Pages.
- Supabase/Postgres como fuente central.
- 107 clubes, 1.152 equipos y 2.689 partidos/fixtures actualmente registrados en producción.
- Directorio de categorías/divisiones/ramas generado desde datos reales.
- Inicio sin filtros: KPI globales + contenido deportivo predeterminado LHC/LHD.
- Directorio global de todos los clubes cargados.
- Perfiles de club, partido y jugador; posiciones, rankings, reportes y buscador.
- Página de cobertura que diferencia fixture, resultados y profundidad estadística.
- Comparador de equipos; capa individual se habilita cuando existan jugadores/participaciones.
- Panel administrativo con Supabase Auth + RLS.
- Esquema preparado para alias, auditoría de importación, lanzamientos, defensa, video y eventos de IA.
- Baseline de detección/tracking versionado en `ai/`.
- Importador idempotente versionado en `tools/`.

> La producción todavía no contiene jugadores, participaciones, resultados ni videos en cantidad utilizable. La interfaz no inventa esas métricas: muestra estados vacíos hasta que la fuente real exista.

## Navegación

- `index.html` — KPI globales, LHC/LHD y todos los clubes.
- `competiciones.html` — mapa de competencias.
- `posiciones.html` — tabla calculada por resultados.
- `partidos.html` / `partido.html` — fixture, resultados y fuentes.
- `clubes.html` / `club.html` — directorio y perfil global multi-competencia.
- `jugadores.html` / `jugador.html` — búsqueda y perfiles individuales.
- `planteles.html` — planteles por equipo/posición.
- `estadisticas.html` — rankings y balances disponibles.
- `cobertura.html` — profundidad real de datos.
- `comparar.html` — comparación de equipos/jugadores.
- `participaciones.html` — acumulados de planillas.
- `reportes.html` — exportaciones.
- `ia-lab.html` — arquitectura de video/IA.
- `admin.html` — gestión autenticada.

## Arquitectura

```text
7Metros/
├── api.js                  # Data API / paginación / resumen global
├── store.js                # normalización, filtros e índices
├── ui.js                   # shell, filtros, búsqueda y escudos
├── pages.js                # render de páginas deportivas
├── features.js             # perfiles y mejoras V3
├── autonomous.js           # cobertura global, comparadores, IA y navegación V4
├── script.js               # bootstrap robusto
├── style.css / v3.css / identity.css / features.css / autonomous.css
├── tools/
│   └── femebal_importer.py
├── ai/
│   ├── pipeline.py
│   └── evaluate.py
├── supabase/migrations/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── OPERATIONS.md
│   └── HANDBALL_AI_BENCHMARK.md
├── ROADMAP.md
└── *.html
```

Para decisiones de arquitectura ver `docs/ARCHITECTURE.md`. Para instalación, administración, importación y uso ver `docs/OPERATIONS.md`. El avance del producto se mantiene en `ROADMAP.md`.

## Ejecutar localmente

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000`. Por usar ES modules no se recomienda `file://`.

## Herramientas de importación

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-tools.txt
python tools/femebal_importer.py --season-id 3 json ejemplo.json
```

El importador es **dry-run por defecto**. Para escrituras backend necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; esa clave jamás debe llegar al frontend ni al repositorio.

## IA / video

El baseline recibe pesos entrenados por fuera del repositorio:

```bash
pip install -r requirements-ai.txt
python ai/pipeline.py partido.mp4 --weights weights/handball.pt --output runs/partido.jsonl
python ai/evaluate.py dataset/gt.jsonl runs/partido.jsonl
```

No se versionan videos ni pesos. Una métrica de precisión solo se considera válida si se obtiene contra ground truth anotado y reproducible.

## Supabase

La publishable key del frontend es pública por diseño; la seguridad depende de RLS. La migración de hardening y analítica está versionada en `supabase/migrations/20260909143000_platform_hardening_and_analytics.sql`.

Principios:
- RLS en recursos expuestos;
- funciones privilegiadas encapsuladas en schema `private`;
- vistas públicas `security_invoker`;
- service role solo en backend;
- eventos de IA públicos únicamente después de revisión.

## Validación

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

GitHub Actions ejecuta estas comprobaciones en PRs.

## Calidad y fuentes

- No interpretar datos ausentes como cero cuando el dominio no lo garantiza.
- No publicar estadísticas simuladas como reales.
- Priorizar información oficial FEMEBAL para competencia y planillas.
- Conservar fuente y, para eventos de video, timestamp.
- Resolver identidades ambiguas mediante alias/revisión, no por adivinanza.

## Nota institucional

7Metros es un proyecto independiente y no representa oficialmente a Fe.Me.Bal. ni a Handball.ai.
