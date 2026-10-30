# Retención compacta de evidencia MOT — 28/09/2026

## Problema

La comparación real baseline / dos etapas / ByteTrack generó JSONL completos de 3.600 frames, pero esos artefactos grandes quedaron sólo en el runtime local. Más tarde fue posible recuperar hashes y métricas agregadas, pero no las cajas por frame de `two_stage` y `bytetrack_standard` para el segundo GT humano. Eso impide repetir TrackEval sobre un intervalo nuevo sin regenerar el benchmark.

## Cambio

Se agregó `sevenmetros_ai.evidence_slices.retain_tracking_slices` y el CLI `retain_tracker_evidence.py` para conservar solamente los rangos que pueden volver a evaluarse con ground truth.

La herramienta:

- conserva los `frame_index` originales;
- acepta varios trackers y varios rangos end-exclusive;
- exige que cada frame solicitado exista en cada JSONL;
- rechaza rangos solapados, nombres de tracker inseguros y directorios de salida no vacíos;
- no modifica las filas ni las cajas;
- genera un JSONL compacto por tracker/rango;
- registra SHA256 del JSONL fuente y de cada slice;
- escribe `manifest.json` con frames, observaciones e IDs de cada slice.

Ejemplo para los dos GT actuales:

```bash
cd ai
python retain_tracker_evidence.py \
  --tracker baseline=comparison/baseline_high_only.jsonl \
  --tracker two_stage=comparison/two_stage.jsonl \
  --tracker bytetrack=comparison/bytetrack_standard.jsonl \
  --range 105:210 \
  --range 2915:3005 \
  --output retained_gt_ranges
```

## Validación

Se agregaron seis tests unitarios para parseo, preservación de frames, múltiples trackers/rangos, ausencia de frames, solapamientos, directorio no vacío y nombre inseguro.

Smoke real sobre `memory30/tracks.jsonl` (3.600 frames):

- rango 105:210: 105 frames, 1.267 observaciones, 16 IDs, ~228 KiB;
- rango 2915:3005: 90 frames, 1.088 observaciones, 18 IDs, ~196 KiB;
- ambos slices conservaron los frames originales y hashes reproducibles.

## Decisión

Esta herramienta no cambia el tracking ni la accuracy. Su objetivo es trazabilidad: toda futura corrida comparativa que vaya a respaldar una decisión de MOT debe conservar los slices de los rangos GT junto con su manifest, aunque los JSONL completos no se versionen.
