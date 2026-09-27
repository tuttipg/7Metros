# Reinferencia selectiva para contactos ambiguos

Se implementó un disparador geométrico para reservar la inferencia 1280 a
cuadros sospechosos y conservar 640 en el resto. No usa puntos anotados ni IDs:
marca un cuadro cuando una caja deduplicada cubre al menos 50% de dos cajas
separadas (IoU mutuo menor a 0,20) de un cuadro adyacente. El aspecto mínimo de
la caja actual es 0,35. Mirar `t+1` hace que la política sea offline y agregue un
cuadro de look-ahead.

`benchmark_selective_resolution.py` hace replay de los dos cachés de inferencia
neuronal ya producidos. No ejecuta inferencia nueva. Verifica que ambos tengan
los mismos índices, calcula el disparador sólo desde 640, sustituye 1280 en los
cuadros elegidos y registra hashes de entrada.

## Resultado sobre los mismos 195 cuadros reales

El disparador seleccionó 40/195 cuadros (20,5%), incluidos los contactos de los
frames 150 y 1105. Después de la regla de duplicados:

| Configuración | Puntos únicos | Compartidos | Ambiguos | Detecciones |
|---|---:|---:|---:|---:|
| 640 completo | 25/30 | 4/30 | 1/30 | 2.911 |
| 1280 completo | 28/30 | 0/30 | 2/30 | 4.139 |
| 640 + 1280 selectivo | 28/30 | 0/30 | 2/30 | 3.181 |

La política selectiva igualó el diagnóstico disperso de 1280 completo usando
sus cajas en sólo 20,5% de los cuadros. Esto no es precisión: los puntos fueron
seleccionados por el asistente, no son ground truth revisado y una caja única no
demuestra detección correcta. Además, los umbrales se exploraron en estas mismas
dos secuencias, no en un conjunto separado.

## Costo

El replay no mide el runtime final. Extrapolando linealmente las corridas ya
medidas (640 completo: 7,074 s; 1280 completo: 17,447 s), ejecutar primero 640 y
reinferir 40 cuadros a 1280 costaría 10,653 s, o 18,30 FPS: 38,9% menos tiempo
que 1280 completo. La decodificación, el batching y el costo del disparador
pueden cambiar ese valor; por eso queda rotulado como estimación.

## Decisión y próxima validación

El disparador queda como componente experimental reproducible, sin cambiar el
default. La próxima prueba debe ejecutar la política realmente sobre una
secuencia más larga, medir su runtime end-to-end y evaluar HOTA/IDF1 sólo cuando
exista GT MOT revisado. También conviene calibrar los umbrales en una secuencia
separada para evitar sobreajuste a estos contactos.
