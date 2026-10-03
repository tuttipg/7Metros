# Ambigüedad detectora en el contacto 217/222 — 28/09/2026

## Objetivo

La auditoría oráculo mostró 0 switches entre GT 217/222 cuando el tracker recibe cajas humanas perfectas. Se midió entonces una hipótesis más acotada: si las detecciones reales de alta confianza contienen cajas que solapan simultáneamente a ambos jugadores durante el contacto.

## Datos

- segundo GT humano QC-v2, 90 frames;
- caché histórica YOLO11n/person de 3.600 frames a confianza ≥0,25;
- GT IDs 217 y 222;
- una detección se marca ambigua cuando alcanza IoU ≥0,20 con ambas cajas GT del mismo frame.

Ambos jugadores están presentes simultáneamente en 89 cuadros. Con el criterio anterior:

- 57/89 cuadros contienen al menos una detección ambigua;
- los cinco switches QC-v2 atribuidos al baseline (task 25, 47, 59, 65 y 68) caen dentro de esos 57 cuadros;
- con criterio más estricto IoU≥0,25 quedan 43 cuadros ambiguos y 3/5 switches;
- con IoU≥0,40 quedan 25 cuadros ambiguos y 2/5 switches.

Ejemplos especialmente claros:

- task 65: una caja fuerte (conf. 0,497) solapa 222≈0,565 y 217≈0,476; otra caja (conf. 0,388) es mucho más específica para 222 (IoU≈0,769);
- task 68: una caja fuerte (conf. 0,556) solapa 222≈0,536 y 217≈0,481; otra caja apenas sobre 0,25 es más específica para 222 (IoU≈0,787).

## Interpretación

La ambigüedad/fusión detectora está asociada al cluster donde ocurren los switches, pero el criterio IoU≥0,20 es demasiado frecuente (57/89) para convertirse directamente en una regla de tracking. No demuestra causalidad ni precisión de un detector alternativo.

Sí explica por qué no conviene añadir ReID o una regla especial 217/222 antes de evaluar cómo el two-stage ordena detecciones fuertes ambiguas frente a débiles más específicas.

## Cambio

Se agrega `audit_detection_ambiguity.py`, que acepta GT MOT, caché JSONL, rango fuente, IDs, umbral de solapamiento y confianza mínima. Reporta frames y detecciones ambiguas sin modificar outputs.

## Decisión

No cambiar el tracker todavía. Próximo experimento cuando esté disponible la caché 0,10: comparar el two-stage actual contra una variante que difiera detecciones fuertes ambiguas y permita resolver conjuntamente las cajas fuertes/débiles; medir ambos GT con TrackEval y conservarla sólo si no regresa HOTA/IDF1/IDSW.
