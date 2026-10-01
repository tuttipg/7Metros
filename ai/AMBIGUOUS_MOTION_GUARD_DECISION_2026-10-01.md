# Cierre de la guardia de velocidad ambigua — 01/10/2026

## Decisión

`AmbiguityVelocityTracker` queda **RECHAZADO** como mejora del `two_stage` actual.

La condición de promoción fijada antes de medir exigía, en cada GT humano:

- HOTA sin regresión;
- IDF1 sin regresión;
- IDSW sin aumento;
- fragmentaciones sin aumento.

El candidato empata al control en GT1 y mejora HOTA/IDF1 en GT2 QC-v2, pero aumenta los ID switches de 6 a 8 en GT2. Por lo tanto falla el guardrail y no se ajustará el umbral `ambiguity_iou` contra estos mismos GT.

## Regeneración reproducible de la caché 0,10

La caché histórica de confianza 0,10 no pudo recuperarse en bytes. Para cerrar el experimento sin sustituirla por una aproximación silenciosa se creó una nueva corrida canónica:

- video original: `20260926-1444-24.0816290.mp4`;
- SHA256 original: `84a94f6e5526d94afc67dc8ee99cc9b390265482d6f0250f2d8a12080e437ed2`;
- intervalo: frames fuente 900:4500, equivalente a 30–150 s;
- 3.600 frames, 936×524, 30 FPS;
- modelo: `yolo11n.pt`;
- SHA256 modelo: `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`;
- Ultralytics: 8.4.163;
- clase: person / COCO 0;
- confianza mínima: 0,10;
- detecciones crudas: 53.973;
- SHA256 cache JSONL: `7f19bc3295f6e7913a17acbc4550c679a5dfc2d2cc9a49e92605b738affba8f6`.

El viejo `fixture120.mp4` x264 no estaba disponible. Para que replay y caché consumieran exactamente los mismos píxeles se generó un fixture lossless FFV1 de los frames fuente 900:4500. Se comprobó programáticamente que los **3.600/3.600 frames** decodificados por OpenCV son bit-idénticos al intervalo del MP4 original.

SHA256 del fixture canónico FFV1:

`9aae8ced56ba8e00022e9af51236d83c4f788481248e0d6b3ee3a85c954b1cde`

No se afirma que esta caché sea byte-idéntica a la histórica (`b825...`): es una regeneración nueva, con modelo/runtime exactos y contenido visual pixel-idéntico al intervalo original. El A/B usa esta única caché para ambos trackers.

## A/B

Configuración común:

- `max_missed=30`;
- `temporal_teams=True`;
- `two_stage=True`;
- filtro temporal uniforme de árbitros habilitado para ambos;
- guardia candidata: `ambiguity_iou=0.30`;
- misma clasificación de fixture y mismas detecciones por frame.

La guardia se activó 456 veces en 3.600 frames, por lo que el experimento tuvo efecto real sobre el estado temporal.

Outputs completos:

- control `two_stage`: SHA256 `b99a4b7c538985a92670df5f84b9b76599c8aa13dbab5d735bdd592b18cda1e3`;
- candidato `ambiguity_velocity`: SHA256 `63b9f09a2ae7e8b48710e4d12d1d483f77230c575002e965bbb389cc42256e0e`.

## TrackEval 1.3.0 oficial

### GT1 — contacto, 105 frames

| Tracker | HOTA | IDF1 | MOTA | IDSW | Frag |
|---|---:|---:|---:|---:|---:|
| `two_stage` | 82.330900 | 86.265432 | 87.858720 | 7 | 15 |
| `ambiguity_velocity` | 82.330900 | 86.265432 | 87.858720 | 7 | 15 |

No hay diferencia en GT1.

### GT2 QC-v2 — reentrada difícil, 90 frames

| Tracker | HOTA | IDF1 | MOTA | IDSW | Frag |
|---|---:|---:|---:|---:|---:|
| `two_stage` | 78.903361 | 82.017749 | 77.155556 | **6** | 21 |
| `ambiguity_velocity` | **79.984455** | **84.407096** | **77.422222** | 8 | **20** |

La guardia mejora asociación y fragmentación, pero agrega dos ID switches. Como el criterio fue definido antes de medir y exige no aumentar IDSW, el resultado es **REJECT**.

Hashes de resultados TrackEval:

- GT1: `1bfe8d466dfb35d600b82265d6c1c3b8e6af4c48b54b16d77b020639c57be047`;
- GT2 QC-v2: `322c328dfa5a21716a7306d0ce53241e2f0dc21212fc91252729c28fc38db169`;
- resumen/guardrail: `bb6e30a1804948a891fc8f64140c24eadea69bf5ee53443e53b189ab058f1b30`.

## Verificación

Se ejecutaron los tests del HEAD usado para el experimento: **186/186 OK**.

El runtime de evaluación usó `trackeval==1.3.0`. La inferencia usó el peso exacto y `ultralytics==8.4.163`.

## Cierre del frente

No se hará barrido de `ambiguity_iou` ni una segunda guardia derivada sobre estos dos GT. `two_stage` sigue como control de tracking y la guardia ambigua permanece sólo como evidencia histórica/experimental apagada.

El desarrollo pasa al siguiente cuello funcional de la demo real: identidad/equipo, pelota, posesión y eventos, priorizando una salida visual verificable sobre Ferro–N. S. de Luján.
