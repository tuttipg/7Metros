# Geometría dinámica de tiro — Ferro–Luján — 01/10/2026

## Problema

La cámara del partido panea. En el GT1 la portería defendida por Luján aparece a la izquierda; más adelante en el mismo fixture la portería defendida por Ferro aparece a la derecha. Por lo tanto una región de gol fija en píxeles no es válida.

## Solución conservadora

Se agregó `shot_geometry.py`.

La portería se representa como un **proxy dinámico**, no como una detección confirmada del arco:
- se usa únicamente un track visible cuyo `role_candidate` termine en `*_GK`;
- el alto de la caja del arquero aporta la escala local;
- ancho del proxy: `±0.85 × altura_GK` alrededor del centro horizontal;
- expansión vertical: `0.15 × altura_GK` arriba y abajo;
- la región se recalcula por frame, por lo que acompaña el paneo de cámara.

Un `BALL FLIGHT?` se convierte en `SHOT?` geométrico sólo si:
1. tiene al menos 3 observaciones detector-backed;
2. conserva su `segment_id` de pelota;
3. se calcula velocidad usando sólo puntos observados;
4. el rayo desde la última observación, manteniendo esa dirección, cruza el proxy dinámico de portería en ≤30 frames.

No se interpola pelota. No se usa un arco fijo. `SHOT?` sigue siendo candidato: no es gol confirmado.

## GT1

Los dos vuelos detector-backed ya retenidos:
- frames 108–112;
- frames 156–160;

se evaluaron contra el proxy de `Lujan_GK` visible en sus frames finales. Ambos **fallan la intersección con la portería**, por lo que el resultado es 0 `SHOT?` geométricos. La inspección visual coincide: son vuelos que no se dirigen al arco.

Esto evita convertir cualquier movimiento lineal de pelota en lanzamiento.

## Sanity positivo: primera transición de marcador

El broadcast muestra 0–0 en fixture frame 300 y 1–0 para Ferro antes del frame 435. La secuencia ofensiva inmediatamente anterior se inspeccionó como contexto positivo, sin usar el marcador como entrada del algoritmo.

Sobre fixture frames 315–339, con el mismo peso YOLO11n, Ultralytics 8.4.163, clase COCO `sports ball`, `imgsz=960` y `conf=0.01`:
- 25 frames;
- 23 candidatos crudos en 17 frames;
- confianza máxima: **0.035374**;
- candidatos `>=0.10`: **0**;
- candidatos `>=0.02`: 3.

`BallObservationTracker` exige una detección `>=0.10` para iniciar un segmento. Por lo tanto el baseline actual no puede producir una trayectoria detector-backed en esa acción de gol.

## Decisión

**KEEP** la geometría dinámica como filtro semántico conservador.

No se relajan los umbrales de `SHOT?` para forzar un positivo. El cuello de botella demostrado pasa a ser la detección de pelota pequeña/rápida durante lanzamientos reales.

Siguiente experimento: propuestas de pelota especializadas en movimiento/objeto pequeño o un detector específico, evaluadas primero sobre la ventana real de marcador y luego sobre los vuelos GT1 ya conocidos.
