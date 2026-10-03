# Auditoría de supresión de duplicados — 28/09/2026

## Problema

En el segundo GT, la identidad 222 tenía cuatro cuadros donde el detector crudo contenía una caja compatible (IoU ≥0,5) pero la salida baseline no. La auditoría por etapas mostró que esas cuatro cajas se pierden exactamente en la regla de duplicados IoU >0,55; el filtro de cancha no elimina ninguna adicional para esa identidad.

Los jugadores próximos al borde superior (GT 215 y 205) no siguen este patrón: detector crudo y salida tienen exactamente 16/90 y 51/89 matches respectivamente. Sus pérdidas ocurren antes del filtro, por falta de caja a confianza ≥0,25.

## Experimento 1 — relajar el umbral global

Se repitió el filtro de cancha sobre la caché real a confianza 0,25, cambiando sólo el umbral de supresión de duplicados. Con 0,55 el replay reproduce exactamente las observaciones y TP/FN/FP históricos de ambos GT.

| GT | umbral | TP | FN | FP | recall | precision |
|---|---:|---:|---:|---:|---:|---:|
| contacto 105 | 0,55 | 1154 | 205 | 113 | 84,92% | 91,08% |
| contacto 105 | 0,60 | 1155 | 204 | 115 | 84,99% | 90,94% |
| contacto 105 | 0,65 | 1156 | 203 | 122 | 85,06% | 90,45% |
| contacto 105 | 0,70 | 1158 | 201 | 138 | 85,21% | 89,35% |
| reentrada 90 | 0,55 | 917 | 208 | 171 | 81,51% | 84,28% |
| reentrada 90 | 0,60 | 918 | 207 | 175 | 81,60% | 83,99% |
| reentrada 90 | 0,65 | 920 | 205 | 187 | 81,78% | 83,11% |
| reentrada 90 | 0,70 | 922 | 203 | 211 | 81,96% | 81,38% |

Subir el umbral recupera muy pocos verdaderos positivos y retiene muchos duplicados/falsos positivos. Se descarta cambiar el valor global 0,55.

## Experimento 2 — heurística geométrica sobre cajas suprimidas

En ambos GT hubo 74 cajas suprimidas por 0,55 que además pasarían el filtro de cancha. Sólo 9 aumentarían el cardinal de matching GT si se recuperaran. Se exploraron confianza, ratio de confianza, IoU con la caja ganadora, distancia de centros normalizada y ratios de área/ancho/alto.

No apareció una separación segura. La mejor conjunción simple que recuperó las 9 cajas útiles también recuperó 21 cajas no útiles. Se descarta agregar una regla geométrica ajustada a estos dos intervalos.

## Experimento 3 — rescate por continuidad temporal simple

También se probó usar las observaciones históricas del tracker: una caja suprimida sería candidata si se parece a un ID visto en los 5 cuadros previos y ausente en el cuadro actual. La mejor regla simple basada en IoU con un track ausente recuperó 6 cajas útiles junto con 6 no útiles; no hubo condición con falsos positivos ≤3 que aportara verdaderos positivos.

Esto no justifica implementar un rescate temporal ad-hoc. Una solución futura debería integrarse con la asociación real y evaluarse con TrackEval, no usar una regla post-hoc ajustada a GT.

## Decisión

- mantener supresión global IoU >0,55;
- no agregar heurística geométrica de rescate;
- no agregar rescate temporal simple;
- mantener separado el problema de detector/umbral en GT 215/205 del problema de asociación durante GT 217/222;
- priorizar recuperar/regenerar la caché 0,10 para medir el segundo GT con dos etapas y ByteTrack antes de cambiar la asociación.