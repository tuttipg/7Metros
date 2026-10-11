# Fallback conservador para reinferencia selectiva

El tramo independiente 2100–2399 mostró que la fusión 1280 podía retirar una
caja 640 aunque dentro de la región sólo hubiera una caja candidata. Eso
contradice el disparador, que se activa porque la caja representa al menos dos
tracks. Se agregó una condición conservadora: si 1280 no aporta dos reemplazos
locales, se conserva el cuadro 640 completo.

Las cajas 1280 aceptadas siguen pudiendo mantener tracks, pero no iniciar IDs.
El runner registra tanto el mínimo exigido como los cuadros que usaron el
fallback.

## Desarrollo y validación reservada

La regla se exploró por replay en 2100–2399. Luego se fijó y se validó mediante
inferencia neuronal nueva, sin puntos de referencia, en el rango panorámico
2400–2699. Las cachés 640 y 1280 de la corrida anterior y la final tienen hashes
idénticos; sólo cambió la política de fusión y su replay.

| Rango | Variante | IDs | Run medio | Observaciones | Reapariciones |
|---|---|---:|---:|---:|---:|
| 2100–2399 | 640 | 29 | 57,397 | 3.329 | 29 |
| 2100–2399 | Selectivo anterior | 29 | 52,312 | 3.348 | 35 |
| 2100–2399 | Selectivo mínimo 2 | 28 | 54,097 | 3.354 | 34 |
| 2400–2699 | 640 | 32 | 68,276 | 3.960 | 26 |
| 2400–2699 | Selectivo anterior | 28 | 66,881 | 3.946 | 31 |
| 2400–2699 | Selectivo mínimo 2 | 28 | 67,017 | 3.954 | 31 |

En validación, el fallback se aplicó en 27/128 cuadros activados. La corrida
final tardó 21,212 s para 300 cuadros (14,14 FPS), sin carga ni warm-up.

## Decisión y límites

La guarda se conserva porque evita una sustitución estructuralmente incompleta
y mejoró de forma consistente observaciones y continuidad respecto de la
variante selectiva anterior. El efecto reservado fue pequeño: ocho
observaciones y 0,136 cuadros de run medio adicionales, sin cambio en IDs o
reapariciones.

La variante selectiva todavía no supera uniformemente al baseline 640 y no se
promueve al pipeline por defecto. No existe GT MOT revisado; estas métricas no
son precisión, IDF1 ni HOTA. La siguiente prioridad sigue siendo obtener GT del
segmento corto y medir identidades con TrackEval.
