# Controles negativos de pelota — 02/10/2026

## Referencia humana

Se amplió el GT positivo existente con tres ventanas de primer plano en las que
la pelota y el campo de juego están completamente fuera de la imagen. Cada uno
de esos 60 cuadros fue revisado y se marcó como `out_of_frame`; no se usaron
oclusiones ni cuadros ambiguos como negativos.

| Muestra | Cuadros | Estado evaluable |
|---|---:|---|
| vuelos 108–112 y 156–160 | 10 | pelota visible con caja humana |
| primer plano 440–459 | 20 | pelota fuera de cuadro |
| primer plano 1340–1359 | 20 | pelota fuera de cuadro |
| primer plano 1940–1959 | 20 | pelota fuera de cuadro |
| **Total** | **70** | **10 positivos + 60 negativos** |

## Inferencia nueva

Se ejecutó inferencia neuronal nueva de YOLO11n COCO `sports ball` sobre los 70
cuadros evaluables, con `imgsz=960` y confianza mínima `.05`. No es replay de la
caché de detecciones de personas.

| Medida local | Resultado |
|---|---:|
| coincidencias positivas, IoU ≥ .50 | 9/10 |
| falsos negativos positivos | 1 |
| falsos positivos en cuadros positivos | 1 |
| cuadros negativos con candidatas | 15/60 |
| candidatas falsas en cuadros negativos | 20 |
| candidatas falsas evaluables totales | 21 |
| precisión sobre sólo los positivos revisados | 0,900 |
| precisión sobre toda la muestra evaluable | 0,300 |
| recall sobre positivos revisados | 0,900 |
| IoU medio de la mejor candidata positiva | 0,7258 |
| error medio de centro positivo | 1,13 px |

Las ventanas 440–459 y 1340–1359 no produjeron candidatas. En cambio, 15 de los
20 cuadros de 1940–1959 produjeron 20 cajas falsas sobre el jugador o regiones
grandes del borde derecho/inferior. La concentración en una sola toma impide
generalizar una tasa por tipo de plano, pero demuestra que las candidatas crudas
no son seguras como señal directa de posesión o evento.

## Cambio reproducible y decisión

El evaluador ahora acepta `out_of_frame` como negativo humano evaluable, mantiene
`ambiguous` y `occluded` fuera de las métricas, y reporta por separado precisión
positiva y precisión sobre la muestra completa. El benchmark ejecuta el detector
en ambos estados evaluables y conserva el alias anterior para compatibilidad.

No se cambió ningún valor predeterminado ni se incorporó un filtro ajustado a
estos primeros planos. El resultado es acuerdo sobre una muestra pequeña y
deliberadamente seleccionada, **no precisión del partido ni del modelo en
general**.

Siguiente prioridad: probar un guard de escena/cancha conservador contra estas
mismas 70 referencias y nuevos vuelos independientes; sólo aceptarlo si elimina
las cajas de primeros planos sin perder ninguna pelota visible. En paralelo,
comparar un detector específico de pelota sobre exactamente el mismo GT.
