# Confianza de detección y ROI superior — 2026-09-28

## Diagnóstico reproducible con la caché 0,10

El auditor de recall de detector ahora estratifica automáticamente por posición
vertical (`y < 5`, `y ≥ 5` y `y == 0`) para cada umbral de confianza. Esto evita
mezclar pérdidas de baja confianza con fallos ligados al borde.

Sobre el segundo GT humano, a IoU 0,5:

| GT ID | Presente | match ≥0,10 | match ≥0,25 | Diagnóstico |
|---|---:|---:|---:|---|
| 205 | 89 | **78** | 51 | principalmente confianza |
| 215 | 90 | 16 | 16 | bajar umbral no ayuda |
| 217 | 89 | 76 | 64 | ganancia parcial a baja confianza |
| 222 | 90 | 81 | 66 | ganancia parcial a baja confianza |

La separación espacial es más concluyente. Para ID 205 con `y < 5`, bajar a
0,10 recupera 42/52 frente a 17/52 a 0,25; con `y ≥ 5` ya alcanza 36/37. Para
ID 215, los 59 frames con `y < 5` quedan en 0/59 incluso a 0,10, mientras que
con `y ≥ 5` alcanza 16/31 sin diferencia entre umbrales. Por eso ID 205 es un
problema de confianza que dos etapas puede aprovechar; ID 215 requiere otra
intervención del detector/localización.

## Prueba con inferencia neuronal nueva

Se evaluó una intervención localizada, sin cambiar el tracker: dos crops
superiores de 300×250 (`x=0–300` y `x=350–650`), YOLO11n/person a 640 y
confianza 0,10, remapeados a la imagen original. Fueron 180 inferencias sobre
90 cuadros en 8,774 s (10,258 cuadros fuente/s). Sólo se fusionaron cajas del
ROI con `y1 ≤ 5`, seguidas por la misma supresión IoU 0,55.

## TrackEval 1.3.0 después del replay

| Tracker | HOTA control→ROI | IDF1 control→ROI | TP | FN | FP | IDSW |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 79,826→78,919 | 82,894→83,117 | 917→964 | 208→161 | 45→67 | 9→10 |
| dos etapas | **81,246→78,010** | **84,191→80,872** | 959→995 | 166→130 | 54→81 | 12→17 |
| ByteTrack | 69,641→70,306 | 80,819→81,919 | 923→973 | 202→152 | 53→70 | 10→12 |

El ROI recupera detecciones, pero el candidato preferido de dos etapas pierde
3,235 puntos HOTA, 3,319 IDF1 y agrega cinco cambios de identidad. Se descarta:
mejor recall de detector no compensa asociaciones ambiguas adicionales.

## Decisión y alcance

- no integrar crops superiores ni cambiar defaults;
- conservar la estratificación espacial en `audit_detection_recall.py`;
- mantener dos etapas y el filtro de roles como opciones experimentales;
- los crops fueron inferencia neuronal nueva; TrackEval posterior fue replay de
  esas cajas, no una segunda inferencia.

Verificación local: 140/140 tests con runtime de visión; entorno mínimo, 127
correctos y 13 omisiones opcionales.

Siguiente prioridad: medir `gap≤5` sobre los tres trackers actuales y luego
atacar swaps 217/222 con una sola modificación de asociación, sin reabrir el
umbral global ni el ROI descartado.
