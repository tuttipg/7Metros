# Asociación selectiva sin creación de identidades

La fusión local 640/1280 separaba mejor los contactos, pero las observaciones
1280 no asociadas podían iniciar tracks nuevos. Se agregó una máscara opcional
`spawnable` a `CentroidTracker.update()`: todas las detecciones siguen
participando de la asociación normal y conservan su confianza, pero una
observación marcada como no iniciadora se descarta si queda sin asociar.

`run_selective_inference.py` marca únicamente las detecciones 1280 insertadas en
regiones de contacto como no iniciadoras. Las detecciones 640 conservadas fuera
de esas regiones mantienen el comportamiento anterior y pueden iniciar tracks.
La máscara no se serializa en el contrato de salida; es una política interna de
asociación y las cajas/confianzas JSON permanecen intactas.

## Ejecución real

Se repitió inferencia neuronal nueva sobre los mismos 195 frames: 640 completo y
1280 en los 53 frames activados. La salida de detecciones tuvo los mismos hashes
que las corridas anteriores. El comando midió 11,979 s o 16,28 FPS, excluyendo
carga y warm-up. Esto es inferencia nueva; el tracking posterior es replay de
esas cajas recién generadas.

| Rango | Métrica | 640 | Selectivo sin spawn |
|---|---|---:|---:|
| 105–209 | IDs | 16 | 16 |
| 105–209 | Run continuo medio | 54,833 | 54,917 |
| 105–209 | Observaciones | 1.316 | 1.318 |
| 1065–1154 | IDs | 16 | 15 |
| 1065–1154 | Run continuo medio | 47,952 | 48,190 |
| 1065–1154 | Observaciones | 1.007 | 1.012 |

La política anterior permitía 17/16 IDs; la nueva eliminó el ID adicional del
primer rango. Conservó 28/30 puntos con caja única, cero compartidos, dos
ambiguos y cero cambios de ID en las muestras. En el segundo rango hubo una
reaparición adicional del mismo ID (6 frente a 5), por lo que los indicadores
no son uniformemente mejores.

## Decisión y límites

El comportamiento solicitado —usar 1280 para mantener tracks sin crear IDs—
queda implementado y probado, pero continúa experimental. Un total menor de IDs
no demuestra mayor precisión: también podría ocultar una persona que entra por
primera vez mientras el contacto está activo. Los puntos no son GT independiente
y los umbrales se exploraron sobre estas secuencias.

No se cambia el default. La próxima prioridad es validar la máscara en un rango
independiente o con GT MOT revisado y comprobar explícitamente entradas/salidas
de jugadores durante contactos antes de integrarla al pipeline general.
