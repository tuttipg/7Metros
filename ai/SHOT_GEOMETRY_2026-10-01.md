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

Los dos vuelos detector-backed ya retenidos (108–112 y 156–160) fallan la intersección con el proxy de `Lujan_GK`, por lo que producen **0 `SHOT?`**. La inspección visual coincide: no se dirigen al arco.

## Corrección de la ventana de acción del primer gol

Una revisión anterior etiquetó `360–375` como la ventana final de la acción. La inspección cuadro a cuadro posterior muestra que allí el equipo ya está en transición. Esa ventana queda reclasificada como **post-acción**.

La secuencia ofensiva y la reacción del arquero de Luján están en **fixture frames 326–340**. Alrededor de 331–335 el arquero reacciona y a continuación comienza la vuelta. El marcador de TV todavía muestra 0–0 porque su actualización llega más tarde; no se usa el cambio del overlay para fijar el frame exacto del lanzamiento.

Sobre `326:341`, el detector COCO genérico sigue sin entregar una trayectoria de pelota fiable:
- YOLO11n @960: 0 observaciones seleccionadas;
- YOLO11n @1280: 5 observaciones, pero el QC visual demuestra que son una marca de cancha estacionaria;
- YOLO11s/m @960 también forman runs sobre la línea punteada de 6 m, no sobre la pelota.

Por lo tanto ni más resolución ni más capacidad COCO resuelven el cuello.

## Decisión

**KEEP** la geometría dinámica como filtro semántico conservador: evita que cualquier `BALL FLIGHT?` se llame tiro y acompaña el paneo.

**REJECT** seguir escalando resolución/modelo COCO como solución de pelota rápida. El siguiente cuello es detectar la pelota en movimiento durante lanzamientos reales mediante señal temporal o un detector específico de objeto pequeño.
