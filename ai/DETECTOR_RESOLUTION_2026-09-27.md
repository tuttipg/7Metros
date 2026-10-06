# Resolución de entrada frente a cajas fusionadas

Se agregó tamaño de entrada opcional al adaptador YOLO y a `run_fixture.py`. Si
se especifica, queda registrado en los metadatos de caché para impedir replay
con una configuración distinta. El default anterior permanece sin cambios.

`benchmark_detector_resolution.py` ejecuta inferencia neuronal nueva para dos
tamaños sobre exactamente los mismos frames, después de un warm-up separado.
Registra hashes, detecciones crudas, regla de duplicados, velocidad y cobertura
de puntos dispersos. No reutiliza la caché `.10` para los números comparados.

## Evidencia ejecutada

Video real Ferro–N. S. de Luján, YOLO11n COCO/person, confianza mínima 0,10.
Se procesaron 195 frames: 105 del contacto atacante/defensor (105–209) y 90 del
cruce de compañeros (1065–1154). Modelo y video conservaron los hashes ya
documentados.

| Configuración | FPS CPU | Detecciones ≥.10 | Tras duplicados | Puntos únicos crudos | Puntos compartidos crudos |
|---|---:|---:|---:|---:|---:|
| 640, corrida A | 27,56 | 3.238 | 2.911 | 22/30 | 2/30 |
| 1280 | 11,18 | 4.555 | 4.139 | 26/30 | 0/30 |
| 640, corrida B | 25,24 | 3.238 | 2.911 | 22/30 | 2/30 |
| 960 | 17,18 | 3.608 | 3.292 | 24/30 | 2/30 |

Después de la regla de duplicados, 640 dejó 25 puntos únicos y 4 compartidos;
960 dejó 26 únicos y 2 compartidos; 1280 dejó 28 únicos, 0 compartidos y 2
ambiguos. En particular, 1280 separó las dos cajas del frame 1105 que 640 había
fusionado. Los hashes idénticos de detecciones 640 entre ambas corridas
confirman reproducibilidad de la salida; la variación de FPS refleja el entorno
de ejecución.

## Decisión

No se cambia el default a 1280: fue aproximadamente 2,47 veces más lento en su
corrida y produjo 41% más detecciones crudas, que pueden incluir duplicados o
falsos positivos. Tampoco se adopta 960 como default: mantuvo una caja
compartida cruda y no existe ground truth completo que demuestre mejor recall.

Sí queda habilitada y protegida por metadatos la resolución configurable. La
hipótesis más eficiente para la próxima prueba es reinferencia 1280 localizada
sólo cuando tracks cercanos o contactos resulten ambiguos, manteniendo 640 para
el resto. Antes de promoverla habrá que medir tracking sobre la misma secuencia
y, cuando exista GT revisado, recall, HOTA e IDF1.

## Límites

Los 30 puntos de torso fueron seleccionados por el asistente, son dispersos y no
tienen revisión independiente. Una caja única por punto no demuestra que la caja
sea correcta; más detecciones no significa mayor precisión. No se ejecutó el
partido completo a 960/1280 ni se calcularon métricas estándar de detección o
tracking.
