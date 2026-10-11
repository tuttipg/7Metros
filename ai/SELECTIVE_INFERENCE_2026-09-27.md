# Inferencia selectiva real y fusión local

Se ejecutó inferencia neuronal nueva sobre los mismos 195 frames reales del
recorte Ferro–N. S. de Luján. El comando reproducible realiza 640 sobre todos
los frames, reproduce el filtro y tracker de dos etapas para encontrar cajas
que contienen dos centros de tracks, y ejecuta 1280 sólo en esos frames. A
diferencia del primer replay, sustituye únicamente detecciones dentro de la
región de contacto y conserva 640 en el resto del cuadro.

El criterio experimental admite tracks ausentes hasta seis frames y exige que
los dos centros predichos estén separados al menos 20% de la diagonal de la
caja. Seleccionó 53/195 frames (27,18%), incluidos 150 y 1105 por sus cajas de
contacto reales.

## Tiempo medido

Se excluyeron carga de modelos y warm-up, igual que en el benchmark de
resolución. El total sí incluye la pasada 640, el replay del disparador, la
segunda decodificación y las 53 inferencias 1280.

| Ejecución | Frames 1280 | Tiempo | FPS |
|---|---:|---:|---:|
| 1280 completo previo | 195 | 17,447 s | 11,18 |
| Selectivo local, corrida A | 53 | 12,246 s | 15,92 |
| Selectivo local, corrida B | 53 | 13,232 s | 14,74 |

La política fue entre 24,2% y 29,8% más rápida que la corrida 1280 completa
medida antes, pero entre 75,2% y 82,3% más lenta que su respectiva pasada 640.
No se extrapoló el tiempo selectivo: son dos mediciones end-to-end del comando,
excluyendo solamente carga y warm-up. Los hashes idénticos de los tres cachés de
detecciones entre ambas corridas confirman salida reproducible; la diferencia de
tiempo corresponde al entorno de ejecución.

## Diagnóstico de cajas y tracking

Después de suprimir duplicados, 640 produjo 2.911 detecciones y la fusión local
2.930. La salida selectiva pasó de 25 a 28 puntos únicos, eliminó los cuatro
puntos con caja compartida y dejó dos ambiguos. Son puntos dispersos elegidos
por el asistente, no ground truth.

| Rango | Configuración | IDs | Run continuo medio | Observaciones |
|---|---|---:|---:|---:|
| 105–209 | 640 | 16 | 54,833 frames | 1.316 |
| 105–209 | Selectivo local | 17 | 50,846 frames | 1.322 |
| 1065–1154 | 640 | 16 | 47,952 frames | 1.007 |
| 1065–1154 | Selectivo local | 16 | 46,045 frames | 1.013 |

En los puntos de identidad dispersos ambos mantuvieron cero cambios de ID. El
selectivo local eliminó las cajas compartidas, pero agregó un ID en el primer
rango y redujo levemente la continuidad media. Esto es salud del tracker, no
IDF1/HOTA ni precisión de identidad.

Como control, sustituir cuadros completos había producido 21/18 IDs y runs
medios de 26,245/34,533 frames. La fusión local redujo esa regresión a 17/16 IDs
y 50,846/46,045 frames sin perder la separación diagnóstica.

## Decisión

Se conserva el ejecutor y la fusión local como experimento reproducible, pero
no se cambia el default 640. La ganancia de separación todavía no compensa una
degradación demostrable, aunque pequeña, en los indicadores de continuidad. La
próxima prioridad es usar las dos detecciones separadas como observaciones de
los dos tracks ya existentes sin permitir que creen IDs nuevos y validar luego
con GT MOT revisado.
