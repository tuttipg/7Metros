# Decisión de tracker sobre dos ground truths humanos — 28/09/2026

## Alcance

La decisión se basa en dos intervalos distintos del mismo fixture real Ferro–N. S. de Luján, ambos revisados frame por frame por una persona y evaluados con TrackEval 1.3.0 mediante replay de la misma caché YOLO11n/person a confianza 0,10.

No es una afirmación de precisión para un partido completo ni para otros clubes/cámaras. Los cambios siguen aislados de producción.

## Comparación con filtro temporal uniforme de roles

### GT 1 — contacto, frames 105–209 (105 frames)

| Tracker | HOTA | IDF1 | MOTA | Recall | Precision | IDSW | Frag |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline ≥0,25 | 85,939 | 90,678 | 83,738 | 84,915 | 99,312 | 8 | 19 |
| dos etapas 0,10/0,25 | **87,437** | **93,380** | **88,374** | **90,066** | 98,789 | 8 | **12** |
| ByteTrack estándar | 74,719 | 86,693 | 88,006 | 88,742 | **99,587** | **5** | 16 |

### GT 2 — reentrada difícil, frames 2915–3004 (90 frames)

| Tracker | HOTA | IDF1 | MOTA | Recall | Precision | IDSW | Frag |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline ≥0,25 | 79,826 | 82,894 | 76,711 | 81,511 | **95,322** | **9** | 28 |
| dos etapas 0,10/0,25 | **81,246** | **84,191** | **79,378** | **85,244** | 94,669 | 12 | **20** |
| ByteTrack estándar | 69,641 | 80,819 | 76,444 | 82,044 | 94,570 | 10 | 24 |

No se promedian HOTA/IDF1 entre ventanas porque son secuencias con dificultades y longitudes distintas; se exige consistencia de la dirección del resultado.

## Decisión experimental

`two_stage` queda como **tracker candidato preferido para seguir desarrollando** dentro de este fixture porque obtiene el mayor HOTA e IDF1 en los dos intervalos humanos y mejora recall/fragmentación frente al baseline. ByteTrack conserva menos ID switches en el primer GT, pero esa ventaja local no compensa su degradación de HOTA/asociación; tampoco supera a dos etapas en el segundo GT.

Esto no cambia todavía el default productivo ni declara generalización. El próximo benchmark debe ampliar partidos, uniformes y situaciones de cámara antes de promover configuración alguna.

## Filtro temporal de árbitros

En ambos GT y para los tres trackers, las observaciones suprimidas por el filtro uniforme no coincidieron ni solaparon a IoU 0,5 con cajas GT. El filtro mejora fuertemente precisión/MOTA en estas ventanas, pero permanece opt-in porque el replay completo de 3.600 frames no tiene GT exhaustivo y podrían existir jugadores/arqueros oscuros fuera de las ventanas anotadas.

## Experimentos retenidos y descartados

- Interpolación lineal de huecos internos ≤5 frames: retener opt-in. Mejoró ambos GT en el baseline; falta ejecutar TrackEval oficial sobre `two_stage` y ByteTrack actuales antes de promoverla.
- Ventanas de interpolación más largas: descartadas porque aumentaron ID switches en la reentrada difícil.
- Relajar globalmente la supresión de duplicados o rescatar cajas por reglas geométricas/temporales simples: descartado. Las ganancias de recall fueron pequeñas y el coste en falsos positivos fue mayor; se conserva IoU 0,55.

## Próximo problema a atacar

El segundo GT concentra 171/208 FN (82,2%) en cuatro identidades: 215, 205, 222 y 217.

- IDs 215 y 205, cerca del borde superior, concentran 112 FN (53,8% del total). La auditoría de bounds existente sólo verifica clipping/serialización de las cajas de salida; no determina si esas ausencias nacen en el detector, en el umbral de confianza o en el filtro de fixture. Próximo paso: atribución de etapa raw detector → confidence → dedup → court/fixture → tracker sobre esos IDs.
- IDs 217 y 222 muestran intercambio/fragmentación durante contacto denso. La interpolación corta no resuelve ese problema. Después de aislar el origen de los misses de borde, el siguiente candidato es una mejora de asociación específica para cruces/oclusiones, evaluada sobre ambos GT sin cambiar simultáneamente el detector.

No se agrega complejidad de ReID/BoT-SORT ni se avanza a pelota/posesión hasta que estas dos fuentes de error estén mejor caracterizadas.
