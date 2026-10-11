# Procedencia de runtime para cachés de pelota — 03/10/2026

## Problema

La caché v1 fijaba hashes de video y peso, clase, umbral, tamaño de entrada y
cobertura de cuadros, pero no identificaba el runtime neuronal. Una regresión
real con las mismas entradas conservó decisiones y métricas, aunque mostró
desvíos máximos de `0,000122 px` en coordenadas y `9,24e-7` en confianza. Sin
versiones registradas, ese tipo de diferencia no podía atribuirse correctamente.

## Cambio

`sevenmetros.ball-detection-cache/v2` agrega a cada caché generada mediante
inferencia:

- versiones de Python, OpenCV, Ultralytics y PyTorch;
- dispositivo efectivo de inferencia;
- arquitectura de máquina;
- cantidad de threads de PyTorch.

El loader valida el contrato completo y rechaza procedencia ausente, campos
extra, strings vacíos o una cantidad de threads inválida. El resultado del
benchmark expone el esquema y la procedencia de la caché usada.

La v1 histórica continúa siendo reproducible sin importar OpenCV, Ultralytics o
PyTorch. Se informa `inference_runtime: null` porque esa información no puede
reconstruirse retroactivamente; no se inventa.

## Validación real

Se ejecutó inferencia neuronal nueva sobre los mismos 113 cuadros revisados con
YOLO11n, clase COCO 32, confianza baja `.02` e `imgsz=960`. La caché v2 contiene
132 detecciones, mide 45.391 bytes y tiene SHA-256
`fc0494dcae2e6355920b4cef1b96c735fd1f62e78412b104cbd8445b5e23f8d5`.

Runtime registrado:

| Componente | Valor |
|---|---|
| Python | 3.12.14 |
| OpenCV | 4.11.0 |
| Ultralytics | 8.4.163 |
| PyTorch | 2.14.0+cpu |
| Dispositivo | CPU, x86_64, 8 threads |

Luego se reprodujo esa caché con el intérprete mínimo, sin importar el stack de
visión. Al quitar únicamente los campos que distinguen deliberadamente el modo
de ejecución (`processing.detector` e `inputs.detection_cache`), la salida de
replay fue exactamente igual a la salida de inferencia.

Como observación local, inferencia tardó 9,436 s y replay 0,327 s. No es un
benchmark general de rendimiento.

Las métricas permanecieron en 44/53 matches, 2 falsos positivos evaluables,
precisión de muestra `0,9565` y recall `0,8302`; no hubo posiciones sintéticas y
los guardrails agregado y por secuencia quedaron en `true`.

Artefactos:

- `ai/evidence/ball/yolo11n_ball_gt_cache_v2_runtime_002_960_2026-10-03.json`;
- `ai/evidence/ball/ball_cache_runtime_provenance_validation_2026-10-03.json`.

## Límites y siguiente prioridad

Registrar el runtime no garantiza determinismo de floats entre hardware; hace
auditable la diferencia. Las métricas corresponden a 53 positivos y 60
negativos seleccionados de un único partido, no a precisión del partido ni
general.

La comparación original de jugadores a confianza `.10` ya está cerrada en los
informes previos; no se repitió. Siguiente prioridad: obtener o entrenar un peso
específico de pelota de handball con datos externos al GT, generar su caché v2
a confianza `.10` y compararlo sobre exactamente los mismos cuadros.
