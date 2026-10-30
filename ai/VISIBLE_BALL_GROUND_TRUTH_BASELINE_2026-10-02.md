# Primer GT positivo de pelota visible — 02/10/2026

## Referencia humana

Se aplicó `sevenmetros.ball-gt/v1` a los dos vuelos visibles identificados en el
fixture Ferro–N. S. de Luján. La revisión se hizo cuadro a cuadro a resolución
nativa y con recortes 8× por vecino más próximo.

| Secuencia | Cuadros | Visible y localizable | Ambiguos |
|---|---:|---:|---:|
| 108–112 | 5 | 5 | 0 |
| 156–160 | 5 | 5 | 0 |
| **Total** | **10** | **10** | **0** |

Las cajas enteras siguen el límite oscuro visible de la pelota, incluido el
desenfoque perceptible. Esto contrasta con la acción 326–340, donde los 15 cuadros
continúan correctamente marcados como ambiguos y no evaluables.

## Inferencia nueva y comparación

Se ejecutó inferencia neuronal nueva de YOLO11n COCO `sports ball` únicamente en
los diez cuadros visibles, con `imgsz=960` y confianza mínima `.05`.

| Medida local | Resultado |
|---|---:|
| cuadros GT visibles | 10 |
| cuadros con una candidata | 10/10 |
| coincidencias IoU ≥ .50 | 9/10 |
| IoU medio de la mejor candidata | 0,7258 |
| error medio de centro | 1,13 px |
| candidatas adicionales | 0 |

El cuadro 111 obtuvo IoU `0,444`: el centro está próximo, pero la caja neuronal
se extiende hacia arriba sobre el rastro de movimiento y no alcanza el umbral de
localización. El benchmark conserva ese fallo; no relaja IoU ni modifica el GT.

## Alcance y decisión

Estas cifras son **acuerdo sobre diez cuadros positivos seleccionados**, no
precision/recall del partido ni prueba de detección de lanzamientos. No hay
cuadros negativos en este conjunto y la misma acción rápida 326–340 sigue sin
pelota humanamente localizable.

El nuevo benchmark ignora por contrato cuadros ambiguos, ocluidos y fuera de
campo en lugar de contarlos como negativos. Por primera vez permite medir
localización contra cajas humanas visibles y deja una base reproducible para
comparar un detector específico de pelota sin confundirlo con el replay anterior.

Siguiente prioridad: añadir ventanas negativas y más vuelos visibles de acciones
independientes; después comparar un modelo específico de pelota con YOLO11n sobre
exactamente el mismo GT, sin usar 326–340 para métricas de localización.
