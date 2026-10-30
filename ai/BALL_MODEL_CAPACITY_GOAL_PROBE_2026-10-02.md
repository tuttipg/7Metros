# Capacidad del detector COCO de pelota — acción del primer gol — 02/10/2026

## Corrección de ventana

La corrida inicial usó fixture frames `360:376` y los describió como la acción del primer gol. Una revisión cuadro a cuadro posterior mostró que esa ventana ya pertenece a la transición posterior: los jugadores están volviendo y no es una ventana válida para estudiar la trayectoria del lanzamiento.

La acción ofensiva al arco izquierdo sigue activa en `326:340`; el arquero de Luján reacciona alrededor de `331:335` y a continuación los jugadores empiezan la transición. Por eso la comparación se repitió sobre fixture frames **`326:341`** (15 frames). El marcador del broadcast todavía muestra 0–0 durante esa secuencia y se actualiza después, por lo que no se usa el overlay como timestamp exacto del tiro.

La antigua `360:376` se conserva únicamente como evidencia histórica de una corrida post-acción y **no** como control positivo de lanzamiento.

## Runtime fijo

- fixture: Ferro – N. S. de Luján;
- ventana: fixture frames `326:341`;
- fuente: mismo MP4 real del pipeline;
- Ultralytics `8.4.163`;
- clase COCO 32 `sports ball`;
- `imgsz=960`;
- inferencia `conf=0.005`;
- continuidad: `BallObservationTracker(low=.02, high=.10, max_missed=3, max_speed=70 px/frame, max_size_ratio=3.0, velocity_alpha=.4)`.

Pesos oficiales:
- YOLO11n SHA256 `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`;
- YOLO11s SHA256 `85a76fe86dd8afe384648546b56a7a78580c7cb7b404fc595f97969322d502d5`;
- YOLO11m SHA256 `d5ffc1a674953a08e11a8d21e022781b1b23a19b730afc309290bd9fb5305b95`.

## Resultado corregido

| modelo | candidatos | frames con candidato | max conf | >=.10 | >=.05 | >=.02 | seleccionados | run máximo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| YOLO11n | 44 | 14/15 | 0.033766 | 0 | 0 | 2 | 0 | 0 |
| YOLO11s | 89 | 15/15 | 0.215960 | 3 | 6 | 16 | 4 | 4 |
| YOLO11m | 15 | 10/15 | 0.120242 | 1 | 2 | 6 | 5 | 4 |

A primera vista `s/m` parecen mejorar continuidad. La inspección visual de todas las observaciones seleccionadas demuestra lo contrario: ambos modelos siguen durante varios cuadros **el mismo segmento de la línea punteada de 6 m**, alrededor de `(x≈445, y≈267)`, prácticamente inmóvil. No es pelota.

Por tanto un run detector-backed de ≥3 cuadros por sí solo no demuestra una trayectoria de pelota si la clase COCO se fija en marcas de cancha.

## Decisión

**REJECT aumentar YOLO11n → YOLO11s/m como solución del lanzamiento.**

El detector más grande aumenta confianza sobre un falso positivo persistente, no recupera la pelota rápida. El siguiente experimento debe explotar información temporal/movimiento o usar un detector específico de pelota pequeña, y debe validarse contra la misma ventana `326:341` más los vuelos reales ya conocidos de GT1.
