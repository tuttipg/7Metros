# Guardrail de filtros de salida — 2026-09-27

## Objetivo

Se agregó `audit_output_filter.py` para impedir que una mejora de precisión
aparente oculte jugadores reales. El auditor compara el MOT antes y después de
un filtro, exige que la salida candidata sea un subconjunto exacto de la salida
control y repite matching húngaro uno-a-uno contra GT con IoU ≥0,5.

La opción `--require-safe` falla la ejecución si una observación eliminada
coincidía o siquiera solapaba al umbral con una caja GT, si cae TP, si aumenta
FN o si la salida agrega/mueve una caja. El diagnóstico complementa TrackEval;
no lo reemplaza y no mide generalización.

## Resultado real del filtro temporal de árbitros

Se auditaron los mismos 105 frames y 1.359 objetos GT del contacto humano
revisado, usando las salidas MOT persistidas antes y después del filtro.

| Tracker | Eliminadas | Track eliminado | Match GT eliminado | Solape GT ≥0,5 | FP antes→después |
|---|---:|---:|---:|---:|---:|
| baseline ≥.25 | 78 | 2 | 0 | 0 | 113 → 35 |
| dos etapas .10/.25 | 78 | 2 | 0 | 0 | 120 → 42 |
| ByteTrack estándar | 105 | 2 | 0 | 0 | 110 → 5 |

Las tres salidas candidatas fueron subconjuntos exactos. No se agregó ni movió
ninguna caja; TP y FN permanecieron iguales. Todas las observaciones removidas
correspondieron al único track 2, el oficial de banda ya identificado.

En los centroides, la exclusión comienza recién en el frame de tarea 28 por la
confirmación temporal; ByteTrack ya traía historia del replay previo al recorte
y excluye el track durante los 105 cuadros. Esto explica la diferencia 78/105
sin atribuirla a precisión del detector.

## Reutilización y límite

El comando acepta pares repetidos `--before LABEL=PATH` y
`--after LABEL=PATH`, hashes de todas las entradas y deja JSON reproducible en
`ai/evidence/trackers/output_filter_safety.json`. Cuando se complete el segundo
GT de reingreso, el mismo `--require-safe` debe pasar antes de considerar
habilitar el filtro por defecto.

Verificación: 129/129 tests con el runtime completo; en el entorno mínimo,
116 correctos y 13 omisiones por dependencias opcionales.

La verificación actual sólo prueba ausencia de pérdidas en este intervalo
humano de 105 frames. El tramo independiente de 90 frames sigue pendiente de
revisión, por lo que no hay afirmación de precisión general ni promoción del
filtro.
