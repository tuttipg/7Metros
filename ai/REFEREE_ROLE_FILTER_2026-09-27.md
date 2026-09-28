# Filtro temporal de árbitros — 2026-09-27

## Resultado

Se agregó una opción experimental, desactivada por defecto, para excluir de la
salida de jugadores a los árbitros sólo después de confirmación temporal. La
asociación sigue viendo y siguiendo esas detecciones: el filtro se aplica a la
salida, para que un oficial no genere identidades nuevas en cada cuadro.

La causa concreta era una protección del clasificador que borraba la pista
`referee` cuando la caja tocaba el borde. El falso positivo persistente del
tramo revisado estaba precisamente sobre el lateral derecho. En el modo
experimental se conservan esas pistas y se exige un mínimo de 3 votos con 75%
de acuerdo en una ventana de 12 observaciones.

Uso en el replay comparativo:

```bash
python ai/benchmark_trackers.py \
  --video fixture120.mp4 \
  --cache detections_010.jsonl \
  --out referee-filter-results \
  --exclude-confirmed-referees
```

En `run_fixture.py`, la opción exige explícitamente `--fixture-kits` y
`--temporal-teams`.

## TrackEval oficial sobre el mismo GT humano

El experimento reutilizó el caché persistido de YOLO11n a confianza 0,10 y el
mismo GT humano de 105 cuadros (frames 105–209 del fixture, 1.359 anotaciones,
13 identidades). Es replay, no inferencia nueva.

| Tracker | HOTA antes | HOTA después | IDF1 antes | IDF1 después | FP antes→después |
|---|---:|---:|---:|---:|---:|
| baseline high-only | 82,844 | 85,110 | 87,053 | 89,717 | 113 → 35 |
| asociación dos etapas | 84,341 | **86,608** | 89,752 | **92,419** | 120 → 42 |
| ByteTrack estándar | 72,102 | 74,719 | 83,290 | 86,693 | 110 → 5 |

TP, FN, IDSW y fragmentaciones permanecieron exactamente iguales en los tres
trackers. Por lo tanto, en este tramo la mejora proviene exclusivamente de
eliminar observaciones de árbitros: −78 FP en cada centroide y −105 FP en
ByteTrack. Dos etapas sigue siendo la mejor variante de este clip por HOTA e
IDF1; esto no establece generalización a otros partidos.

## Replay completo y tramo independiente

El replay completo procesó 3.600 cuadros y excluyó 3.282, 3.490 y 4.343
observaciones de rol en baseline, dos etapas y ByteTrack, respectivamente.
Estas cantidades no son métricas de precisión porque no hay GT completo.

En el tramo independiente de reingreso (frames 2915–3004), todavía sin revisión
humana, se conservaron las 27 observaciones del evento ID 222 del seed baseline.
Se excluyeron dos candidatos por tracker; la inspección visual del baseline los
ubica en un oficial vestido de negro y una detección de borde/mezclada. Este
resultado es sólo diagnóstico hasta completar el segundo GT.

## Verificación y límites

- Suite con runtime de visión: 123/123 tests.
- Suite mínima: 113 tests correctos y 10 omisiones opcionales esperadas.
- TrackEval 1.3.0 sobre bundle validado y hashes registrados en
  `ai/evidence/trackers/referee_role_filter.json`.
- El filtro permanece desactivado por defecto: sombras, uniformes negros y
  cajas mezcladas aún pueden engañar una heurística cromática específica del
  fixture.

La siguiente prioridad es completar la revisión humana del segundo tramo de 90
cuadros y medir si el filtro conserva jugadores e identidades durante la caída,
la oclusión de 21 cuadros y el reingreso.
