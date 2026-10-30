# Confirmación uniforme de roles — 2026-09-27

## Problema corregido

El primer filtro temporal no comparaba a los trackers con exactamente la misma
lógica: baseline y dos etapas consumían el rol ya confirmado dentro de
`CentroidTracker`, mientras ByteTrack usaba las pistas instantáneas. Esto hacía
que el mismo oficial se excluyera durante 78 de 105 cuadros en los centroides y
105 de 105 en ByteTrack.

Ahora `Track` conserva por separado `observed_role_candidate` —evidencia del
cuadro actual— y `detection.role_candidate` —rol temporal mostrado—. Los tres
trackers pasan sus observaciones instantáneas por la misma instancia y
configuración de `TemporalRoleFilter`: 3 votos, 75% de acuerdo, ventana de 12.
La asociación interna no se filtra.

## Validación sobre GT humano

Se repitió el replay completo desde la misma caché YOLO11n a confianza 0,10 y
TrackEval 1.3.0 sobre los mismos 105 cuadros revisados.

| Tracker | HOTA previo→uniforme | IDF1 previo→uniforme | FP previo→uniforme |
|---|---:|---:|---:|
| baseline ≥.25 | 85,110 → 85,939 | 89,717 → 90,678 | 35 → 8 |
| dos etapas .10/.25 | 86,608 → **87,437** | 92,419 → **93,380** | 42 → 15 |
| ByteTrack estándar | 74,719 → 74,719 | 86,693 → 86,693 | 5 → 5 |

TP, FN, IDSW y fragmentaciones no cambiaron. El guardrail de salida verificó
que las 105 eliminaciones de cada tracker pertenecen sólo al track 2 y que
ninguna coincide ni solapa al umbral IoU 0,5 con una caja GT.

## Replay completo y cautela

Sobre 3.600 cuadros, el filtro uniforme excluye 4.663 observaciones del baseline
y 4.949 de dos etapas, frente a 3.282 y 3.490 con la implementación anterior.
ByteTrack permanece en 4.343. Este aumento no demuestra mejor precisión porque
no existe GT completo y podría incluir uniformes oscuros, sombras o cajas
mezcladas.

En el tramo independiente aún no revisado se conserva el evento baseline ID
222 con sus 27 observaciones, pero los centroides excluyen 126 observaciones de
dos tracks candidatos frente a 81 antes. No se interpreta como acierto hasta
tener GT humano.

## Decisión

La comparación quedó metodológicamente uniforme y mejora el único intervalo
revisado sin pérdida GT. Aun así, `--exclude-confirmed-referees` permanece
desactivado por defecto. Se requieren el segundo GT de reingreso y el guardrail
`--require-safe` antes de promoverlo.

Verificación: 131/131 tests con runtime completo; entorno mínimo, 118 correctos
y 13 omisiones opcionales. Las salidas son replay de la inferencia persistida,
no inferencia neuronal nueva.
