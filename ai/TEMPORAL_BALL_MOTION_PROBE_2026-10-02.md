# Probe temporal de pelota rápida — 02/10/2026

## Hipótesis

Después de rechazar YOLO11s/m porque seguían una marca fija de la línea de 6 m,
se probó una alternativa sin cambiar el detector de jugadores: residuo temporal
de tres cuadros, compensación global de cámara, máscara de jugadores y enlace de
componentes oscuras pequeñas. La salida se llama **motion proposal**; nunca
`BALL`, `SHOT` o `GOAL`.

## Validación sobre video real

Se fijaron antes de medir cuatro ventanas del fixture Ferro–N. S. de Luján:

| Ventana | Referencia | Propuestas | Tracklets ≥3, velocidad ≥8, linealidad ≥.70 | Hacia proxy de arco |
|---|---:|---:|---:|---:|
| vuelo 108–112 | 5 puntos detector-backed | 40 | 9 | 0 |
| vuelo 156–160 | 5 puntos detector-backed | 20 | 3 | 0 |
| acción de gol 326–340 | sin GT de pelota | 116 | 24 | **0** |
| post-acción 360–375 | control negativo | 764 | 45 | **1 falso candidato** |

El residuo temporal recupera los 10/10 puntos de los dos vuelos ya observados a
menos de 5 px; el error mediano fue 0,64 px y 0,32 px. Esto verifica que la
implementación detecta movimiento real visible en los controles.

Sin embargo, no recupera ninguna trayectoria de al menos tres puntos dirigida al
arco en la acción de gol. En el control negativo sí produce un candidato dirigido
al arco. La señal temporal simple separa una pelota visible de una línea fija,
pero no separa de forma fiable pelota rápida, bordes de jugadores y movimiento de
cámara cuando el objeto aparece en menos de tres cuadros.

## Decisión

**REJECT como solución del lanzamiento rápido.** No se integra al pipeline ni se
cambia ningún default. Se conserva el módulo y el benchmark como diagnóstico
reproducible para evitar repetir este enfoque y para evaluar futuros detectores
específicos de pelota con los mismos controles.

Los puntos de referencia son observaciones del detector revisadas como sanity
check, no ground truth humano; por lo tanto no se reportan precision, recall ni
accuracy. El fixture local usado en este probe es la copia x264 disponible en el
runtime (SHA256 `7bfad9a...`), no el fixture FFV1 canónico del A/B de tracking.

## Verificación

- 225/225 tests en runtime completo;
- entorno mínimo: 208 correctos y 17 omisiones opcionales;
- no hubo inferencia neuronal nueva en este probe;
- no se tocó Supabase ni producción.

Siguiente prioridad: preparar una referencia humana mínima de pelota en la acción
326–340 y evaluar un detector específico de pelota pequeña/handball. Sin ese GT,
seguir ajustando umbrales temporales sólo sobre la misma jugada sería sobreajuste.
