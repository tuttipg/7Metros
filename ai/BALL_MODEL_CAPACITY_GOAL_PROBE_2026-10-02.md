# Capacidad del detector COCO de pelota — primer gol real — 02/10/2026

## Objetivo

Después de comprobar que subir `imgsz` de YOLO11n no genera una trayectoria usable en el primer gol real, se probó si aumentar la **capacidad del mismo detector COCO** (`sports ball`, clase 32) resuelve el cuello.

La comparación mantiene fija la ventana, la resolución de inferencia y la política de continuidad de pelota. Sólo cambia el tamaño del modelo.

## Ventana y runtime

- fixture: Ferro – N. S. de Luján;
- ventana real de primer gol: fixture frames `360:376` (16 frames);
- MP4 fuente: el mismo archivo real usado por el pipeline;
- Ultralytics: `8.4.163`;
- clase: COCO 32 `sports ball`;
- `imgsz=960`;
- inferencia: `conf=0.005`;
- continuidad: `BallObservationTracker(low=.02, high=.10, max_missed=3, max_speed=70 px/frame, max_size_ratio=3.0, velocity_alpha=.4)`.

Pesos oficiales:
- YOLO11n SHA256 `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`;
- YOLO11s SHA256 `85a76fe86dd8afe384648546b56a7a78580c7cb7b404fc595f97969322d502d5`;
- YOLO11m SHA256 `d5ffc1a674953a08e11a8d21e022781b1b23a19b730afc309290bd9fb5305b95`.

## Resultados

| modelo | candidatos crudos | frames con candidato | max conf | >=.10 | >=.05 | >=.02 | seleccionados tracker | run máximo | vuelo usable >=3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| YOLO11n | 34 | 15/16 | 0.108592 | 1 | 2 | 5 | 1 | 1 | no |
| YOLO11s | 30 | 14/16 | 0.115193 | 1 | 1 | 5 | 1 | 1 | no |
| YOLO11m | 33 | 15/16 | 0.027980 | 0 | 0 | 1 | 0 | 0 | no |

YOLO11n selecciona una única observación en frame 371; YOLO11s una única observación en frame 367; YOLO11m no puede iniciar segmento fuerte. Ninguno construye una trayectoria detector-backed de tres cuadros.

La inspección visual de las observaciones seleccionadas muestra evidencia de pelota durante la transición posterior a la acción, pero **no** una secuencia del lanzamiento al arco. Por lo tanto más capacidad COCO no recupera el dato que falta.

## Decisión

**REJECT aumentar n → s/m como solución del cuello de pelota rápida.**

No se cambia el baseline de pelota por un modelo más pesado: en esta ventana real no agrega continuidad y `m` incluso pierde la única observación fuerte.

El siguiente experimento deja de exprimir el detector COCO por frame y pasa a una señal **temporal/específica de pelota** (movimiento entre frames o detector entrenado para pelota deportiva pequeña), manteniendo como control negativo los dos `BALL FLIGHT?` de GT1 y como control positivo la ventana real del primer gol.
