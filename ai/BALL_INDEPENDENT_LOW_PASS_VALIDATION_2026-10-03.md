# Validación independiente de selección temporal: pase bajo 1726–1741

Fecha: 2026-10-03  
Rama: `automation/ai-baseline-v1`  
Video revisado: fixture x264 936×524, SHA-256
`7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d`

## Revisión humana

Se revisaron dos ventanas nuevas localizadas por el screening neuronal, siempre
sobre cuadros sin cajas:

- 1691–1703 contiene una desaparición detrás de jugadores, pero las detecciones
  posteriores corresponden a un zapato y no prueban una reaparición de pelota;
  por eso no se usó como validación de oclusión.
- 1726–1741 contiene un segundo pase bajo independiente. La pelota es visible y
  localizable en los 16/16 cuadros; no hay una oclusión real. Las cajas humanas
  siguen el límite visible y el desenfoque de movimiento.

El GT acumulado pasa de 37 a **53 positivos visibles** y conserva 60 negativos
humanos `out_of_frame`.

## Inferencia y comparación

Se ejecutó inferencia neuronal nueva YOLO11n COCO `sports ball`, `imgsz=960`,
confianza `.02`, sobre todos los cuadros de las ocho secuencias GT. Control
`.05`, guardia de cancha y selección temporal se derivan de exactamente las
mismas cajas de esa corrida. La selección temporal nunca interpola una posición.

Resultado específico de la acción nueva:

| 16 positivos, frames 1726–1741 | Matches | FP evaluables | Recall | Mayor hueco visible |
|---|---:|---:|---:|---:|
| cajas crudas ≥ `.05` | 11/16 | 3 | 0,6875 | 2 |
| guardia de cancha | 11/16 | 3 | 0,6875 | 2 |
| guardia + selección temporal | **12/16** | **1** | **0,7500** | 2 |

La mejora recupera el frame 1732 mediante una caja neuronal débil existente e
IoU 0,546 con el GT humano. No recupera el frame 1734, donde la corrida no
ofrece una observación compatible. También descarta dos falsas candidatas junto
a jugadores.

Resultado agregado sobre 53 positivos + 60 negativos:

| Variante | Matches | FP evaluables | Precisión de muestra | Recall | Mayor hueco visible |
|---|---:|---:|---:|---:|---:|
| cajas crudas ≥ `.05` | 43/53 | 32 | 0,5733 | 0,8113 | 4 |
| guardia de cancha | 43/53 | 12 | 0,7818 | 0,8113 | 4 |
| guardia + selección temporal | **44/53** | **2** | **0,9565** | **0,8302** | 4 |

## Guardrail por secuencia

El benchmark ahora informa cada secuencia positiva por separado y sólo acepta
el candidato si no empeora matches, falsos negativos, falsos positivos ni el
mayor hueco visible en **cada** secuencia, además del agregado. Las secuencias
exclusivamente negativas permanecen cubiertas por la evaluación agregada.

La corrida pasó ambos controles:

- no-regresión agregada: `true`;
- no-regresión en cada secuencia visible: `true`.

Sensibilidad sobre la acción nueva:

| `max_missed` | Matches | FP | Recall | Mayor hueco |
|---:|---:|---:|---:|---:|
| 3 | 12/16 | 1 | 0,7500 | 2 |
| 4 | 12/16 | 1 | 0,7500 | 2 |
| 5 | 12/16 | 1 | 0,7500 | 2 |

## Decisión y límites

La selección temporal se valida en una segunda acción humana independiente y
permanece opt-in. **Esta acción no distingue `max_missed=3/4/5`**, por lo que no
valida específicamente el valor experimental 4 ni justifica cambiar el default.

Son 113 cuadros seleccionados de un único partido y una única sede, no precisión
general ni del partido completo. La inferencia `.02` fue nueva; las comparaciones
posteriores son replay de esas cajas persistidas. No hubo posiciones sintéticas.

Siguiente prioridad: encontrar una reaparición humana inequívoca tras 4 cuadros
sin observación, o evaluar otra sede, y comparar un detector específico de
pelota sobre exactamente los mismos 53 positivos.

