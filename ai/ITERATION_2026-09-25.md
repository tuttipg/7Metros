# Iteración sin fixture — 25/09/2026

Base remota comprobada: PR #43 abierto, rama automation/ai-baseline-v1,
43f431583814101ce7d8fb6e9350b9c10d9ab090. Cambios locales derivados; no publicados.

## Comparación reproducible

El baseline pasó sus 21 tests. Antes de corregirlo, los nuevos tests de regresión
fallaron en dos casos deterministas:

| Caso | Baseline | Corregido |
|---|---|---|
| Movimiento 10 px/frame con 2 frames perdidos | Velocidad recuperada 30 px/frame | 10 px/frame |
| home → unknown → away en la misma posición | away recibe ID 1 de home | away recibe nuevo ID |

La memoria de equipo afecta solo a la asociación. La salida de una observación
sin color sigue siendo unknown; no se falsea cobertura. Una etiqueta inicial
errónea todavía puede fragmentar un track: falta validar y calibrar en video real.

Batería final ejecutada: 29/29 tests aprobados, frente a 21/21 del baseline.
Los ocho tests nuevos incluyen las dos regresiones que fallaban antes del cambio,
separación de roles conocidos, protección de rutas y exportación CLI de métricas.

## Preparación de ejecución

- CLI acepta referencias RGB de dos equipos y guarda resumen JSON.
- Resumen incluye hash SHA256 del video, configuración, referencias RGB,
  tiempo/FPS de procesamiento, duración media de tracks en segundos y detecciones
  por equipo y rol. El hash se calcula por bloques, sin cargar el MP4 completo.
- Rechaza colisiones entre rutas de entrada/salida, límites no positivos y
  metadatos de video sin FPS o dimensiones válidas.
- identity_switches=null y accuracy_status=not_evaluated_no_ground_truth.

```sh
cd ai
python -m unittest discover -s tests -v
python -m sevenmetros_ai.cli --video partido.mp4 \
  --output-jsonl artifacts/run1/tracks.jsonl \
  --output-video artifacts/run1/annotated.mp4 \
  --output-summary artifacts/run1/metrics.json --max-frames 7200
```

7200 frames equivalen a 2 minutos a 60 FPS, o 4 minutos a 30 FPS.
Usar rutas distintas para baseline y versión nueva; mismos pesos, umbrales y MP4.
Opcional: `--team-references teams.json`, con dos claves team_a/team_b y valores
RGB obtenidos del video. No se suministran colores inventados para Ferro/Luján.
La calibración automática existente todavía no se conecta a la CLI.

## Límites

Tests de pipeline y CLI emplean dobles de prueba: no demuestran inferencia neuronal
ni procesamiento de MP4 real. No se entrenó ningún modelo. No se midió rendimiento
en FEMEBAL. La clasificación automática de árbitros/arqueros sigue pendiente;
solo se comprobó que sus etiquetas conocidas impiden robar IDs de jugadores.
Los conteos son detecciones de personas, no cantidades de jugadores únicos reales.
El tiempo de procesamiento excluye carga del modelo y cálculo posterior del hash.

Bloqueado por MP4: ajuste de colores, estabilidad real de IDs, rol automático,
coordenadas de cancha, precisión y comparación visual. No se tocó Supabase.
