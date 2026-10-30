# Validación independiente de asociación selectiva

Se eligió antes de ejecutar la inferencia el rango panorámico 2100–2399 del
mismo clip. Queda fuera de los rangos 105–209 y 1065–1154 usados para explorar
el disparador y la fusión. El muestreo visual cada 50 cuadros y el detector de
cortes de `ffmpeg` con umbral de escena 0,25 no señalaron un cambio de cámara en
este tramo.

`run_selective_inference.py` ahora permite omitir referencias. En ese modo no
produce un diagnóstico de puntos ni insinúa precisión: ejecuta inferencia y
reporta solamente salud del tracker. También se agregó
`audit_track_births.py`, que compara los nacimientos usando observaciones
serializadas idénticas y distingue una caja perdida/reemplazada de una caja
asociada a un track ya existente.

## Ejecución real

Se ejecutó inferencia neuronal nueva con confianza 0,10: 640 en los 300 cuadros
y 1280 en los 103 cuadros activados (34,3%). Tardó 20,510 s, equivalentes a
14,63 FPS, sin contar carga ni warm-up. El tracking es replay de esas detecciones
recién generadas.

| Métrica de replay | 640 | Selectivo sin spawn |
|---|---:|---:|
| IDs únicos | 29 | 29 |
| Run continuo medio (cuadros) | 57,397 | 52,312 |
| Observaciones de track | 3.329 | 3.348 |
| Reapariciones del mismo ID | 29 | 35 |
| Observaciones con confianza < 0,25 | 121 | 113 |

En ambos sentidos, el auditor encontró 18 nacimientos después del primer
cuadro: 16 nacieron también en el otro replay y dos observaciones fueron
absorbidas por un track ya existente. No hubo nacimientos cuya observación
idéntica estuviera perdida o reemplazada en el otro replay.

## Decisión y límites

La política no suprimió observaciones de nacimiento compartidas en este rango,
pero tampoco mejoró la salud general: mantuvo el número de IDs y empeoró el run
continuo medio en 8,9%, con seis reapariciones adicionales. Por eso no se
promueve al pipeline por defecto.

No hay anotación MOT revisada. El auditor exacto explica diferencias entre dos
replays, pero no sabe si una identidad, una caja o un nacimiento son correctos.
La siguiente prioridad es revisar GT del rango y medir IDF1/HOTA; después se
puede decidir si restringir aún más la fusión o descartarla.
