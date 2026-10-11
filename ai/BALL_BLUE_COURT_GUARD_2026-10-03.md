# Guardia de cancha para candidatas de pelota — 03/10/2026

## Hipótesis y criterio previo

Los controles negativos mostraron 20 cajas falsas de `sports ball` sobre un
primer plano sin cancha. Se probó una única mejora conservadora: aceptar
candidatas solamente cuando el cuadro contiene evidencia suficiente de la cancha
azul del fixture.

No se ajustó un umbral nuevo contra estas 70 referencias. Se reutilizó exactamente
el criterio histórico de `BlueCourtClassifier`: el mayor contorno HSV azul debe
ocupar al menos el 15% del cuadro. La opción queda desactivada por defecto y está
expuesta en `run_ball_demo.py` como `--require-blue-court`.

## Replay sobre el mismo GT

La comparación reutiliza las cajas de inferencia neuronal persistidas en
`visible_ball_gt_with_negatives_2026-10-02.json` y calcula una máscara de escena
nueva sobre el video. Por lo tanto es **replay de cajas neuronales + procesamiento
nuevo de escena**, no inferencia neuronal nueva.

| Medida local | Control | Guardia de cancha |
|---|---:|---:|
| coincidencias positivas, IoU ≥ .50 | 9/10 | 9/10 |
| recall sobre positivos revisados | 0,900 | 0,900 |
| candidatas eliminadas en positivos | — | 0 |
| candidatas falsas en negativos | 20 | 0 |
| falsos positivos evaluables totales | 21 | 1 |
| precisión sobre la muestra evaluable | 0,300 | 0,900 |

Los diez cuadros positivos tuvieron entre 63,87% y 65,13% de cancha azul. Los
60 negativos tuvieron entre 3,37% y 25,59%; dos cuadros superaron el 15%, pero ya
carecían de candidatas. El guard rechazó 58/60 cuadros negativos y retiró las 20
cajas falsas sin retirar candidatas en cuadros con pelota visible.

## Implementación y decisión

- `blue_court_fraction` centraliza la medición que antes estaba embebida en el
  clasificador de personas;
- `blue_court_present` expone el mismo criterio fail-closed con validación;
- `run_ball_demo.py` puede aplicarlo de forma opt-in y registra por cuadro si el
  guard estaba habilitado y si había cancha;
- el benchmark conserva decisiones y fracciones por cuadro para auditoría.

**KEEP opt-in sobre este fixture.** No se habilita por defecto porque el GT sigue
siendo pequeño y deliberadamente seleccionado. Tampoco es una solución general:
depende del color de esta cancha y podría rechazar tomas útiles en otra sede o una
pelota grande durante un primer plano.

Estas cifras son acuerdo sobre 10 positivos y 60 negativos humanos, no precisión
del partido ni del modelo. El único falso positivo restante es la caja mal
localizada del cuadro positivo 111 (IoU 0,444), que el guard conserva correctamente
porque sí existe cancha.

Siguiente prioridad: sumar vuelos visibles y negativos de otras acciones/cámaras;
después comparar un detector específico de pelota sobre el mismo GT y exigir que
cualquier promoción mantenga todas las observaciones humanas visibles.
