# Contrato de cajas y cola de revisión MOT

Al preparar una cola de revisión para la tarea MOT existente se detectó que la
salida ByteTrack podía extender cajas fuera de la imagen. En los 3.600 cuadros
del replay había 885 observaciones que requerían recorte; ninguna estaba
completamente fuera del cuadro. Baseline y dos etapas no tenían casos.

`frame_payload()` ahora recorta toda caja al ancho y alto declarados, recalcula
el centro serializado y omite una observación sólo si no queda área visible. El
benchmark registra por tracker cuántas cajas fueron recortadas u omitidas.

## Verificación sobre la caché real

Se repitió el benchmark desde la misma caché de detecciones con confianza 0,10.
Fue replay, no inferencia neuronal nueva. Las asociaciones y métricas quedaron
idénticas; únicamente cambió la geometría serializada de ByteTrack:

| Tracker | Cajas recortadas | Omitidas | Cajas inválidas finales |
|---|---:|---:|---:|
| Baseline | 0 | 0 | 0 |
| Dos etapas | 0 | 0 | 0 |
| ByteTrack estándar | 885 | 0 | 0 |

El exportador de TrackEval pudo convertir el rango 105–209 completo: 1.267
filas baseline, 1.344 de dos etapas y 1.316 de ByteTrack. Esto elimina el
bloqueo estructural, pero todavía no habilita métricas sin GT revisado.

## Priorización de revisión

Se agregó `prepare_mot_review_queue.py`. Compara conteos, transiciones y cajas
entre los tres trackers con emparejamiento IoU determinista. Produce JSON y CSV
ordenados por desacuerdo, con hashes de entradas y una marca explícita de que no
es ground truth.

En los 105 cuadros, 73 obtuvieron prioridad no nula y 32 acuerdo geométrico y de
eventos bajo esta heurística. Los primeros cuadros fuente de la cola son 158,
159, 142, 161, 129, 143 y 145. La revisión humana debe cubrir igualmente los
105 cuadros: el acuerdo de modelos puede esconder un error compartido o un
cambio de identidad sin diferencia geométrica.

## Límite y siguiente paso

El recorte sólo garantiza un contrato espacial válido. La cola reduce el costo
de empezar por los casos difíciles, pero no acredita precisión. La siguiente
prioridad es completar la revisión independiente, generar `gt/gt.txt` y recién
entonces ejecutar IDF1, HOTA, MOTA y recall con TrackEval.
