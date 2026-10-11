# Interpolación conservadora de huecos internos cortos — 28/09/2026

## Problema observado

Los dos intervalos con ground truth humano conservan fragmentación causada por huecos internos breves aun después de mantener memoria de tracking y, en el baseline actual, filtrar roles confirmados. La hipótesis probada fue rellenar solamente pérdidas internas muy cortas cuando el mismo `track_id` existe antes y después del hueco.

La intervención no intenta resolver reidentificación: si los extremos ya tienen un ID incorrecto, la interpolación no puede corregirlo. Tampoco separa cajas fusionadas del detector.

## Regla evaluada

- máximo 5 frames faltantes (0,1667 s a 30 FPS);
- interpolación lineal de `bbox_xyxy` entre dos observaciones del mismo `track_id`;
- sin extrapolación antes de la primera ni después de la última observación;
- no crea IDs;
- no modifica cajas observadas;
- sólo une extremos con el mismo `kind`;
- confianza sintética = mínimo de las dos observaciones extremas;
- `team` sólo se conserva si ambos extremos coinciden;
- cada observación sintética queda marcada con `interpolated=true` y `interpolation_gap_frames`.

## Evidencia sobre GT humano

La prueba se hizo sobre el baseline actual con filtro temporal uniforme de árbitros. El evaluador local había reproducido exactamente las métricas oficiales de TrackEval del primer GT antes de usarlo para esta comparación.

| Intervalo | Métrica | Antes | Gap≤5 |
|---|---|---:|---:|
| contacto 105 frames | HOTA | 85,939137 | 86,537337 |
| contacto 105 frames | IDF1 | 90,678302 | 91,520125 |
| contacto 105 frames | MOTA | 83,738043 | 85,283297 |
| contacto 105 frames | Recall | 84,915379 | 87,049301 |
| contacto 105 frames | IDSW | 8 | 7 |
| contacto 105 frames | fragmentaciones | 19 | 8 |
| reentrada 90 frames | HOTA local aprox. | 79,826078 | 81,214384 |
| reentrada 90 frames | IDF1 | 82,894106 | 84,284378 |
| reentrada 90 frames | MOTA | 76,711111 | 79,644444 |
| reentrada 90 frames | Recall | 81,511111 | 85,244444 |
| reentrada 90 frames | IDSW | 9 | 9 |
| reentrada 90 frames | fragmentaciones | 28 | 15 |

Ventanas mayores fueron descartadas en el intervalo difícil porque aumentaron los cambios de identidad.

## Implementación

`sevenmetros_ai.postprocess.interpolate_short_internal_gaps` implementa la regla como transformación pura de JSONL `7metros-ai.v1`. `interpolate_track_gaps.py` la expone como CLI y se niega a sobrescribir el archivo de entrada o un output existente.

Ejemplo:

```bash
cd ai
python interpolate_track_gaps.py \
  --input /ruta/baseline_high_only.jsonl \
  --output /ruta/baseline_gap5.jsonl \
  --max-missing-frames 5 \
  --report /ruta/baseline_gap5_report.json
```

La suite agrega regresiones para interpolación, límite de longitud, no extrapolación, cambio de `kind`, conflicto de equipo, duplicado de ID, discontinuidad de frames e inmutabilidad del input.

Como smoke test adicional, el JSONL histórico `memory30` completo de 3.600 frames pudo procesarse sin error. La regla detectó 593 huecos e insertó 1.264 observaciones sintéticas. Este conteo NO es una mejora de accuracy; muestra que el efecto a escala es material y justifica mantenerlo experimental.

## Decisión

La función queda **opt-in** y no cambia el pipeline por defecto. No debe alimentar eventos/posesión como si las cajas fueran observaciones reales sin conservar la marca `interpolated`.

Antes de considerar promoción falta aplicar exactamente el mismo postproceso a las salidas actuales `two_stage` y `bytetrack_standard` sobre ambos GT humanos y repetir TrackEval oficial. Esas salidas completas no están persistidas en el repositorio ni en los artefactos disponibles de esta sesión.
