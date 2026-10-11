# Atribución de errores MOT en el contacto revisado

Se agregó `audit_mot_errors.py` para explicar los conteos agregados de TrackEval
por frame, identidad GT e ID del tracker. Usa asignación húngara uno-a-uno con
IoU ≥0,5. El resultado es diagnóstico: no reemplaza HOTA, CLEAR o Identity.

La suma de TP/FN/FP coincide exactamente con TrackEval para los tres trackers.
Esto protege el análisis contra una divergencia silenciosa de matching.

| Tracker | TP | FN | FP | Frames sin FN | IoU medio de matches |
|---|---:|---:|---:|---:|---:|
| baseline ≥.25 | 1.154 | 205 | 113 | 0 | 0,991 |
| dos etapas .10/.25 | **1.224** | **135** | 120 | **17** | 0,973 |
| ByteTrack estándar | 1.206 | 153 | **110** | 13 | 0,876 |

Dos etapas recupera 70 verdaderos positivos frente al baseline y sólo agrega 7
falsos positivos. La ganancia se concentra en identidades difíciles: ID 14 pasa
de 75% a 100% de recall, ID 13 de 58,1% a 78,1% e ID 20 de 16,2% a 36,2%.

Los tres trackers mantienen un falso positivo sistemático durante los 105
frames: el ID 2. Representa 105/113 FP del baseline, 105/120 de dos etapas y
105/110 de ByteTrack. La inspección visual de los frames de tarea 1, 53 y 105
confirma que es una persona vestida de negro en la banda derecha —árbitro u
oficial— que el GT de jugadores excluye. Esto identifica clasificación de rol y
filtrado de cancha como el mayor error de precisión del recorte, no la asociación.

ByteTrack muestra además fragmentación visible en el mapeo con GT: la identidad
3 se divide entre sus IDs 58 y 3; la 9 entre 9, 63 y 62; y la 17 entre 3 y 41.
Esto explica por qué puede tener menos IDSW locales pero peor IDF1 y AssA.

## Decisión

Se mantiene dos etapas como candidato. No se implementa todavía un filtro por
borde o ropa negra: ajustarlo sobre este único intervalo sería sobreajuste y
podría eliminar jugadores o arqueros legítimos. La próxima mejora debe evaluar
clasificación temporal de árbitros en un segundo segmento humano revisado y
recién entonces excluir roles confirmados de la salida de jugadores.

Las cajas evaluadas son replay de la caché de inferencia existente; no hubo
inferencia neuronal nueva. El IoU casi perfecto del baseline también está
afectado por el origen del GT, que partió de propuestas automáticas, y no prueba
superioridad geométrica general.
