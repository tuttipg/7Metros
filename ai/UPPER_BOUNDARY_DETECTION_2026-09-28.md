# Diagnóstico de detección en borde superior — 28/09/2026

## Problema observado

El segundo GT humano (fixture frames 2915–3004) concentra 112/208 falsos negativos del baseline en dos identidades situadas repetidamente contra el borde superior de la imagen: GT 205 y 215.

Se recuperó la caché histórica YOLO11n/person generada con confianza mínima 0,25 y se agregó `audit_detection_recall.py` para medir disponibilidad de cajas GT antes del tracking.

## Resultado por etapa ≥0,25

Con IoU ≥0,5:

| GT ID | visible | match detector ≥0,25 | match baseline final |
|---|---:|---:|---:|
| 205 | 89 | 51 | 51 |
| 215 | 90 | 16 | 16 |
| 217 | 89 | 64 | 64 |
| 222 | 90 | 66 | 62 |

Para 205 y 215, toda caja GT-matching que existe en la caché ≥0,25 llega también a la salida baseline. Por lo tanto sus 38 y 74 pérdidas respectivamente ya existen antes de la asociación del tracker a este umbral.

## Estratificación espacial

Separando por coordenada superior de la caja GT:

| ID | y < 5 px | recall detector | y ≥ 5 px | recall detector |
|---|---:|---:|---:|---:|
| 205 | 52 frames | 17/52 = 32,7% | 37 frames | 34/37 = 91,9% |
| 215 | 59 frames | 0/59 = 0% | 31 frames | 16/31 = 51,6% |

Además, en los frames donde `y == 0`, ambos IDs tienen 0 detecciones válidas a IoU 0,5: 0/12 para 205 y 0/35 para 215.

Esto es una correlación fuerte y localizada con truncamiento por borde. No demuestra todavía que padding sea la solución, pero sí descarta “más memoria del tracker” como primera respuesta para estos dos IDs.

## Próximo experimento medible

No cambiar el tracker simultáneamente. Mantener `two_stage` como asociación candidata y comparar únicamente la etapa de detección en el mismo segundo GT.

Orden propuesto:

1. recuperar/regenerar la caché original a confianza 0,10;
2. ejecutar `audit_detection_recall.py` a 0,10 y 0,25 para 205/215;
3. si una fracción relevante reaparece a 0,10, tratarlo como problema de confianza y medir el beneficio ya capturado por dos etapas;
4. si sigue ausente a 0,10, comparar una reinferencia localizada del borde superior (padding o ROI/crop con coordenadas remapeadas) contra el mismo detector de control;
5. medir recall de detector por ID, FP en ambos GT, TrackEval completo y coste CPU;
6. conservar el cambio sólo si mejora detección/TrackEval sin una penalización desproporcionada de falsos positivos o rendimiento.

No se cambia globalmente a 1280 como primer paso: la prueba previa mostró casos concretos de separación de cajas fusionadas pero aproximadamente 2,47× menos throughput. El fallo actual está espacialmente concentrado en el borde y merece primero una intervención localizada.

## Límites

- la caché disponible para este diagnóstico comienza en 0,25 y no permite saber cuántas cajas existen entre 0,10 y 0,25;
- son dos identidades de un único intervalo de 90 frames;
- `audit_detection_recall.py` es diagnóstico de disponibilidad de caja, no una métrica MOT ni una identificación nominal;
- no se promueve padding/ROI hasta ejecutar inferencia real y TrackEval.
