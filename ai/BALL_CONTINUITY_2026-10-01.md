# Continuidad detector-backed de pelota — Ferro–Luján — 01/10/2026

## Objetivo

El baseline inicial de `sports ball` demostraba que YOLO11n ve la pelota real, pero sólo exponía candidatos independientes por frame. El siguiente paso funcional es aumentar continuidad **sin inventar posiciones** antes de intentar posesión.

Se agregó `BallObservationTracker`, una asociación temporal conservadora para una única pelota:

- una detección fuerte (`confidence >= 0.10`) es necesaria para iniciar un segmento;
- una detección débil (`0.02 <= confidence < 0.10`) sólo puede mantener un segmento ya activo;
- la asociación usa posición predicha por velocidad, límite de desplazamiento y consistencia de tamaño;
- un segmento vence tras un hueco corto (`max_missed=3`);
- si no existe una caja detectora compatible en el frame actual, la salida es `None`;
- **no hay interpolación, Kalman visible ni posición sintética**.

`run_ball_continuity_demo.py` produce JSONL `7metros-ai.ball-observations.v1` y un MP4 donde cada observación queda marcada como `strong` o `weak`. Los cuadros sin evidencia dicen explícitamente `ball: no observed candidate`.

## Probe de resolución

Sobre los mismos 105 frames de GT1 y el mismo peso YOLO11n, a confianza detectora 0.01:

| imgsz | frames con algún candidato | candidatos crudos | tiempo local aprox. |
|---:|---:|---:|---:|
| 640 | 28/105 | 33 | 5.13 s |
| 960 | 92/105 | 251 | 6.13 s |
| 1280 | 105/105 | 962 | 8.88 s |

No existe GT humano de pelota, por lo que esos números son **densidad de candidatos**, no recall/precision. `1280` no se toma como default: genera una corriente débil muy densa y más costosa. Para el prototipo temporal se usa `960` como compromiso aislado de pelota; el detector de jugadores no cambia.

## Ejecución real — GT1

- partido: Ferro–N. S. de Luján;
- MP4 fuente SHA256: `84a94f6e5526d94afc67dc8ee99cc9b390265482d6f0250f2d8a12080e437ed2`;
- frames fuente: 1005–1109 inclusive (fixture 105–209);
- 105 frames, 936×524 @ 30 FPS;
- modelo SHA256: `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`;
- Ultralytics 8.4.163; clase COCO 32 `sports ball`;
- `imgsz=960`, `low=0.02`, `high=0.10`, `max_missed=3`;
- velocidad máxima 70 px/frame; ratio máximo de tamaño 3.0; `velocity_alpha=0.4`.

Resultados:

- candidatos crudos: 114 en 68/105 frames;
- baseline fuerte, misma inferencia (`>=0.10`): 24 frames con evidencia, run contiguo máximo 10;
- selección temporal: **38/105 frames**;
- 23 observaciones fuertes + 15 débiles;
- 5 segmentos;
- run observado contiguo máximo: **14 frames**;
- posiciones sintéticas emitidas: **0**.

La asociación aumenta la continuidad detector-backed de 24 a 38 frames (+14 observaciones) y el run máximo de 10 a 14. Esto es continuidad/selección, no accuracy: todavía no existe ground truth de pelota.

Se inspeccionaron visualmente las 38 cajas seleccionadas como sanity check. La inspección muestra señal útil para continuar, pero no se convierte en precision/recall ni en una afirmación de posesión.

Artefactos locales:
- MP4 demo SHA256: `0a2431a7bb6e434ac7136807ce7d8d4b8dbfd4ae5bbcf56f82a59c4883b55724`;
- JSONL SHA256: `053933b75e878bddd73e09121cfc8c8e9f22b421a0270008c2022e1e71e62aba`.

## Tests

Suite local: **197/197 OK**.

## Decisión

**KEEP como baseline funcional experimental de continuidad de pelota.**

No se usa todavía para afirmar posesión. El siguiente paso es asociar únicamente estas observaciones detector-backed con jugadores cercanos y producir candidatos de posesión con estado `observed/unknown`, manteniendo `unknown` en cuadros sin pelota observada.
