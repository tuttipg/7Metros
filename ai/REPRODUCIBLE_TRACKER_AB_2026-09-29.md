# Benchmark A/B reproducible con evidencia retenida — 29/09/2026

## Problema corregido

Las primeras comparaciones reales generaron JSONL completos de 3.600 frames, pero los outputs de baja confianza no quedaron persistidos. Más tarde existían métricas y hashes, pero no las cajas por frame necesarias para rerunear TrackEval o evaluar una hipótesis nueva sobre los dos GT. La herramienta `retain_tracker_evidence.py` ya permitía guardar slices, pero era un paso manual separado y por lo tanto podía omitirse.

## Runner nuevo

`run_tracker_ab_experiment.py` convierte esa retención en parte del experimento. En una sola ejecución:

1. corre el benchmark control;
2. corre el mismo benchmark con `AmbiguityVelocityTracker`;
3. conserva inmediatamente los slices JSONL de baseline, `two_stage` y ByteTrack para cada rango GT;
4. hashea video, caché, metadata, `comparison.json`, JSONL fuente, slices y manifests;
5. escribe `experiment_manifest.json` con settings y rutas;
6. no calcula accuracy ni declara ganador: el siguiente paso sigue siendo TrackEval.

Los rangos por defecto son los dos GT humanos actuales, end-exclusive:
- GT1: `105:210`;
- GT2: `2915:3005`.

Ejemplo cuando vuelva a estar disponible la caché detectora exacta a 0,10:

```bash
cd ai
python run_tracker_ab_experiment.py \
  --video /ruta/fixture120.mp4 \
  --cache /ruta/detections_conf010.jsonl \
  --output /ruta/ab_ambiguous_motion \
  --exclude-confirmed-referees \
  --ambiguity-iou 0.30
```

## Guardrails

- directorio de salida debe estar vacío;
- la caché sigue siendo validada por `benchmark_trackers.py` contra el hash del video y confianza ≤0,10;
- si un tracker no produce JSONL o falta un frame pedido, la corrida falla;
- `max_frames`, si se usa, debe cubrir todos los rangos retenidos;
- ByteTrack se ejecuta sin la guardia en control y candidato y permanece como control externo;
- el manifest marca explícitamente `accuracy_status=TRACKING_OUTPUTS_ONLY_TRACK_EVAL_REQUIRED`.

## Tests

Los tests usan un benchmark sintético/mokeado para verificar que:
- control y candidato se ejecutan una vez cada uno con flags opuestos;
- los slices pedidos se escriben realmente para los tres trackers;
- el manifest queda persistido;
- un output no vacío bloquea la corrida antes de benchmark;
- `max_frames` incapaz de cubrir el rango GT se rechaza.

Este cambio no modifica tracking, detector, Supabase ni producción. Sólo hace más difícil perder la evidencia necesaria para una decisión posterior.
