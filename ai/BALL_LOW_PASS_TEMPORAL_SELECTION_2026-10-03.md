# Pase bajo y selección temporal de pelota — 03/10/2026

## Acción humana nueva

El screening neuronal a 5 FPS sobre los 3.600 cuadros se usó únicamente para
localizar acciones candidatas. No define ground truth ni participa de las
métricas. La revisión posterior encontró un pase bajo independiente en los
frames 1405–1419, donde la pelota cruza una línea discontinua y pasa cerca de
las piernas de jugadores.

Los 15 cuadros se revisaron a resolución nativa y en recortes **sin cajas** 8×
por vecino más próximo. En los 15/15 la pelota conserva un límite oscuro
separable y localizable; las cajas enteras humanas incluyen el desenfoque
visible. El GT positivo pasa de 22 a **37 cuadros**, y se mantienen los 60
negativos humanos `out_of_frame`.

## Diagnóstico con inferencia nueva `.05`

Se ejecutó inferencia neuronal nueva YOLO11n COCO `sports ball`, `imgsz=960`,
confianza `.05`, sobre los 97 cuadros evaluables.

En el pase bajo:

- matches IoU ≥ .50: **11/15**;
- fallos consecutivos: frames **1408–1411**;
- falsos positivos evaluables: **8**;
- recall local: **0,7333**.

La pelota sigue siendo humanamente visible al cruzar la línea, pero durante
cuatro cuadros YOLO no ofrece una caja compatible ni siquiera a confianza
`.001`; en su lugar entrega una falsa candidata estable en otra región de la
cancha. El frame 1412 vuelve a incluir la pelota y una candidata falsa.

El evaluador ahora conserva `visible_miss_runs` y
`longest_consecutive_visible_miss_run`, para que un agregado global no esconda
este tipo de hueco temporal.

## Mejora probada: guardia de escena + selección temporal

Se agregó un benchmark que ejecuta inferencia neuronal nueva una sola vez a
confianza `.02` sobre cada cuadro de las secuencias GT y deriva tres variantes
de exactamente esas mismas cajas persistidas:

1. control crudo con cajas ≥ `.05`;
2. control con la guardia opt-in de cancha azul;
3. guardia + `BallObservationTracker`, con `low=.02`, `high=.05` y
   `max_missed=4`.

La tercera variante sólo selecciona una caja detectora existente en el cuadro
actual. No interpola ni emite posiciones sintéticas.

| 37 positivos + 60 negativos | Matches | FP evaluables | Precisión de muestra | Recall | Mayor hueco visible |
|---|---:|---:|---:|---:|---:|
| cajas crudas ≥ `.05` | 32/37 | 29 | 0,5246 | 0,8649 | 4 |
| guardia de cancha | 32/37 | 9 | 0,7805 | 0,8649 | 4 |
| guardia + selección temporal | **32/37** | **1** | **0,9697** | **0,8649** | **4** |

La selección temporal elimina las ocho candidatas incompatibles de la acción
nueva sin perder matches humanos. El único FP restante es la caja mal localizada
del frame 111, ya conocida.

Sensibilidad de `max_missed` sobre la misma muestra:

| `max_missed` | Matches | FP | Recall | Mayor hueco |
|---:|---:|---:|---:|---:|
| 3 histórico | 24/37 | 7 | 0,6486 | 12 |
| **4** | **32/37** | **1** | **0,8649** | **4** |
| 5 | 32/37 | 1 | 0,8649 | 4 |

`4` es el menor valor no regresivo en esta cuadrícula, pero fue seleccionado y
medido sobre la misma muestra. Por eso la combinación queda **experimental y
opt-in**; no cambia el default del pipeline ni demuestra generalización.

## Límites y decisión

- Las métricas corresponden a 97 cuadros seleccionados de un partido y una
  cancha, no a precisión general ni de partido completo.
- La corrida `.02` es inferencia neuronal nueva; umbral, guardia y asociación
  son comparaciones derivadas de las cajas de esa misma corrida.
- Los cuatro cuadros 1408–1411 siguen sin observación detectora compatible. La
  asociación se abstiene correctamente y no inventa la trayectoria.
- La guardia depende del color de esta cancha.
- `max_missed=4` necesita validación en otra acción antes de considerar un cambio
  de default.

**Decisión:** conservar el benchmark y la selección temporal como candidato
opt-in. Siguiente prioridad: probarla en una acción humana independiente con
oclusión real y luego en otra sede; en paralelo, comparar un detector de pelota
específico sobre exactamente los 37 positivos actuales.
