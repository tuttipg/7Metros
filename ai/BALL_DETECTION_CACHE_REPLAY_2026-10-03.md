# Caché estricta y replay del detector de pelota — 03/10/2026

## Objetivo

El benchmark de pelota volvía a ejecutar YOLO aun cuando sólo cambiaban el
umbral fuerte, la guardia de escena o la asociación temporal. Eso dificultaba
demostrar que dos variantes consumían exactamente las mismas observaciones y
obligaba a tener OpenCV/Ultralytics disponibles para cada replay.

Se implementó el contrato `sevenmetros.ball-detection-cache/v1` para persistir:

- SHA-256 del video y del peso;
- nombre del peso, clase COCO 32, confianza baja `.02` e `imgsz=960`;
- cobertura exacta y ordenada de cada secuencia GT;
- todas las cajas/confianzas neuronales de los 113 cuadros;
- fracción de cancha azul usada por la guardia.

El loader falla de forma cerrada ante cualquier diferencia de fuente, modelo,
configuración, secuencias, orden, duplicados, cuadros faltantes, geometría o
confianza inválida. Un archivo de salida preexistente no se sobrescribe y se
rechaza antes de cargar el runtime neuronal.

## Validación real

Se ejecutaron dos corridas sobre los mismos 53 positivos y 60 negativos:

1. **inferencia neuronal nueva** con YOLO11n y generación de caché;
2. **replay estricto** de esa caché, sin importar OpenCV ni ejecutar YOLO.

La caché contiene 113 cuadros, ocupa 45.150 bytes y tiene SHA-256
`6ccaa11216e81287ee6812783b9a23bfc89f3205d016c9e82b145aaf9ca251d0`.

Después de quitar únicamente los dos campos que identifican deliberadamente el
modo de ejecución (`processing.detector` e `inputs.detection_cache`), **todos los
campos restantes de ambas salidas son exactamente iguales**.

| Variante | Matches | FP evaluables | Precisión de muestra | Recall | Mayor hueco |
|---|---:|---:|---:|---:|---:|
| cajas crudas ≥ `.05` | 43/53 | 32 | 0,5733 | 0,8113 | 4 |
| guardia de cancha | 43/53 | 12 | 0,7818 | 0,8113 | 4 |
| guardia + selección temporal | 44/53 | 2 | 0,9565 | 0,8302 | 4 |

Los controles de no-regresión agregada y por cada secuencia visible permanecen
en `true`; no se generaron posiciones sintéticas.

Como observación local única, la corrida fresca tardó 11,63 s y el replay 0,35 s.
Es una comprobación de reproducibilidad, no un benchmark general de rendimiento.

## Decisión y límites

La caché queda disponible para barridos de asociación y para comparar un futuro
detector específico de handball contra el mismo conjunto de cuadros. No cambia
ningún default del pipeline.

La corrida fresca fue inferencia neuronal nueva; la segunda fue exclusivamente
replay. La evidencia cubre secuencias seleccionadas de un único partido y no
demuestra precisión general ni del partido completo.

Siguiente prioridad: obtener o entrenar un peso específico de pelota de handball
con datos externos al GT de evaluación, y generar otra caché con el mismo
contrato para una comparación estrictamente alineada.

