# Decisión de tracker sobre ground truths humanos — 28/09/2026

## Alcance

Existen dos intervalos humanos del fixture Ferro–N. S. de Luján. El GT 1 está cerrado. El GT 2 recibió una auditoría QC posterior que detectó y corrigió un único swap recíproco de IDs en task frame 3 (217 ↔ 222), por lo que su tabla TrackEval anterior queda como evidencia histórica **pre-QC** y debe rerunearse antes de usarla como métrica oficial final.

No es una afirmación de precisión para un partido completo ni para otros clubes/cámaras. Los cambios siguen aislados de producción.

## GT 1 — contacto, frames 105–209 (105 frames)

TrackEval 1.3.0 con filtro temporal uniforme de roles:

| Tracker | HOTA | IDF1 | MOTA | Recall | Precision | IDSW | Frag |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline ≥0,25 | 85,939 | 90,678 | 83,738 | 84,915 | 99,312 | 8 | 19 |
| dos etapas 0,10/0,25 | **87,437** | **93,380** | **88,374** | **90,066** | 98,789 | 8 | **12** |
| ByteTrack estándar | 74,719 | 86,693 | 88,006 | 88,742 | **99,587** | **5** | 16 |

## GT 2 — reentrada difícil, frames 2915–3004 (90 frames)

La tabla siguiente fue calculada antes del QC-v2. Se conserva para trazabilidad, no para cierre final:

| Tracker | HOTA pre-QC | IDF1 pre-QC | MOTA pre-QC | Recall | Precision | IDSW | Frag |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline ≥0,25 | 79,826 | 82,894 | 76,711 | 81,511 | **95,322** | **9** | 28 |
| dos etapas 0,10/0,25 | **81,246** | **84,191** | **79,378** | **85,244** | 94,669 | 12 | **20** |
| ByteTrack estándar | 69,641 | 80,819 | 76,444 | 82,044 | 94,570 | 10 | 24 |

QC-v2 corrigió sólo identidad en un frame: task frame 3 intercambiaba 217/222 y en los frames 2 y 4 volvía a la continuidad visual original. Una auditoría de todos los pares presentes en t-1/t/t+1 encontró ese único swap recíproco. Como HOTA/IDF1/IDSW son sensibles a identidad, no se extrapolan métricas corregidas: se exige rerun con los mismos outputs persistidos.

## Decisión experimental provisional

`two_stage` sigue siendo el tracker candidato preferido por el GT 1 oficial y por la dirección consistente de la evidencia pre-QC del GT 2. Sin embargo, la afirmación “mejor en ambos GT oficiales” queda suspendida hasta rerunear TrackEval del GT 2 QC-v2.

Esto no cambia el default productivo ni declara generalización.

## Filtro temporal de árbitros

En las evaluaciones previas, las observaciones suprimidas por el filtro uniforme no coincidieron ni solaparon a IoU 0,5 con cajas GT. El filtro permanece opt-in porque no existe GT exhaustivo de los 3.600 frames ni validación suficiente sobre otros uniformes/partidos. El segundo GT debe volver a evaluarse contra QC-v2 antes de usar sus métricas finales.

## Experimentos retenidos y descartados

- Interpolación lineal de huecos internos ≤5 frames: retener opt-in. Antes de promoverla debe repetirse sobre los outputs actuales y GT 2 QC-v2.
- Ventanas de interpolación más largas: descartadas por aumento de swaps en la evidencia pre-QC.
- Rescate global/simple de duplicados: descartado; pequeñas ganancias de recall con demasiados FP. IoU 0,55 se conserva.
- Histograma HSV simple de torso para el cruce 217/222: descartado. En 85/87 transiciones distinguía continuidad, pero falló exactamente en 2→3 y 3→4, las transiciones del swap/oclusión más difícil, por lo que no es una señal segura de asociación.

## Próximos problemas

### Borde superior — IDs 205/215

La caché histórica ≥0,25 demuestra que sus pérdidas nacen antes del tracker:
- 205: 51/89 cajas GT disponibles en detector y 51/89 en baseline;
- 215: 16/90 en detector y 16/90 en baseline.

Cuando `y < 5 px`, recall del detector cae a 32,7% para 205 y 0% para 215; fuera de ese borde sube a 91,9% y 51,6%. Próximo experimento: recuperar caché 0,10 y, si la ausencia persiste, probar padding/ROI selectivo del borde con medición de recall, FP, TrackEval y coste CPU.

### Contacto denso — 217/222

No ajustar el tracker contra el frame 3 pre-QC. Después del rerun QC-v2 se vuelve a atribuir la fragmentación real restante. No se integra ReID/BoT-SORT ni se avanza a pelota/posesión hasta separar claramente error de detección, anotación y asociación.
