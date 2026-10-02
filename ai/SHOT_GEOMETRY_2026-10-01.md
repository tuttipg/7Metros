# Geometría dinámica de tiro — Ferro–Luján — 01/10/2026

## Problema

La cámara del partido panea. En GT1 la portería defendida por Luján aparece a la izquierda; más adelante la portería defendida por Ferro aparece a la derecha. Por lo tanto una región de gol fija en píxeles no es válida.

## Solución conservadora

Se agregó `shot_geometry.py`.

La portería se representa como un **proxy dinámico**, no como una detección confirmada del arco:
- sólo se usa un track visible cuyo `role_candidate` termine en `*_GK`;
- el alto de la caja del arquero aporta escala local;
- ancho del proxy: `±0.85 × altura_GK` alrededor del centro horizontal;
- expansión vertical: `0.15 × altura_GK` arriba y abajo;
- la región se recalcula por frame y acompaña el paneo.

Un `BALL FLIGHT?` se convierte en `SHOT?` geométrico únicamente si:
1. tiene al menos 3 observaciones detector-backed;
2. conserva su `segment_id` de pelota;
3. la velocidad se estima sólo con puntos observados;
4. el rayo desde la última observación, manteniendo dirección, cruza el proxy dinámico de portería en ≤30 frames.

No se interpola pelota. No se usa un arco fijo. `SHOT?` sigue siendo candidato, no gol confirmado.

## GT1 — control negativo real

Los dos vuelos detector-backed ya retenidos:
- frames 108–112;
- frames 156–160;

se evaluaron contra el proxy de `Lujan_GK` visible en sus frames finales. Ambos **fallan la intersección con la portería**, por lo que producen 0 `SHOT?`. La inspección visual coincide: son vuelos que no se dirigen al arco.

Esto evita convertir cualquier desplazamiento lineal de pelota en lanzamiento.

## Sanity positivo: primer gol del broadcast — corrección de ventana

El broadcast permanece 0–0 durante el ataque y corta al festejo de Ferro alrededor del fixture frame 376. La inspección cuadro a cuadro ubica el final de la acción de gol en la ventana **360–375**. Una revisión inicial había usado frames 315–339, que pertenecían a la construcción del ataque; esa ventana queda reemplazada por esta evidencia corregida.

Se ejecutó exactamente el mismo peso YOLO11n (`0ebbc80d…`), Ultralytics 8.4.163 y clase COCO 32 `sports ball` sobre frames 360–375.

### imgsz=960, inferencia conf=0.005
- 16 frames;
- 34 candidatos crudos en 15/16 frames;
- confianza máxima: **0.108592**;
- candidatos `>=0.10`: **1**;
- candidatos `>=0.05`: 2;
- candidatos `>=0.02`: 5;
- `BallObservationTracker(low=.02, high=.10)` selecciona **1 sola observación** (frame 371);
- segmentos con ≥3 observaciones: **0**.

### imgsz=1280, inferencia conf=0.005
- 16 frames;
- 166 candidatos crudos en 16/16 frames;
- confianza máxima: **0.052882**;
- candidatos `>=0.10`: **0**;
- candidatos `>=0.05`: 2;
- candidatos `>=0.02`: 33;
- `BallObservationTracker(low=.02, high=.10)` selecciona **0 observaciones** porque no existe detección fuerte de inicio.

Además, en la ventana anterior 315–339, 1280 generó 173 candidatos y 5 cajas `>=0.10`; la inspección visual de las más fuertes muestra que corresponden principalmente a segmentos de la línea punteada de 6 m. Con el tracker actual esas falsas cajas pueden formar un segmento detector-backed largo, por lo que **más densidad no equivale a mejor detección de pelota**.

## Decisión

**KEEP** la geometría dinámica como filtro semántico conservador.

**REJECT** `imgsz=1280` como solución suficiente al lanzamiento: aumenta fuerte el ruido en la cancha y no genera una trayectoria utilizable en el primer gol real.

No se bajará el umbral fuerte para forzar un positivo. El cuello de botella demostrado es ahora la detección de pelota pequeña/rápida durante lanzamientos reales.

Siguiente experimento: comparar un detector COCO de mayor capacidad sobre exactamente la misma ventana; si tampoco produce una secuencia coherente, pasar a detector temporal/específico de pelota.
