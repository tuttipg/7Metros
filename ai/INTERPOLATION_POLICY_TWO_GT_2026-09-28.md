# Política de interpolación sobre dos GT — 2026-09-28

## Primero: TrackEval oficial con QC-v2

Se repitió TrackEval 1.3.0 sobre el segundo GT después de corregir el swap humano
recíproco 217/222 del task frame 3. Los conteos de detección no cambian, pero sí
la asociación:

| Tracker | HOTA | IDF1 | MOTA | IDSW | Frag. |
|---|---:|---:|---:|---:|---:|
| baseline | 79,884 | 82,990 | 77,067 | **5** | 28 |
| dos etapas | **81,319** | **84,284** | **79,733** | 8 | **20** |
| ByteTrack | 69,675 | 80,914 | 76,444 | 10 | 22 |

Dos etapas continúa liderando HOTA/IDF1 en ambos GT humanos. Estas cifras
reemplazan la tabla pre-QC del segundo intervalo.

## Barrido de interpolación para dos etapas

Se aplicó la transformación existente —lineal, sólo huecos internos del mismo
ID, sin extrapolar y con marca `interpolated=true`— sobre los 3.600 cuadros.

| Máximo gap | GT1 HOTA / IDF1 | GT2 QC-v2 HOTA / IDF1 | IDSW GT1/GT2 | Frag. GT1/GT2 |
|---:|---:|---:|---:|---:|
| control | 87,437 / 93,380 | 81,319 / 84,284 | 8 / 8 | 12 / 20 |
| 1 | 87,437 / 93,380 | 81,380 / 84,299 | 8 / 8 | 12 / 19 |
| 2 | 87,458 / 93,385 | 81,638 / 84,451 | 8 / 8 | 10 / 17 |
| **3** | **87,458 / 93,385** | **81,664 / 84,612** | **8 / 8** | **10 / 17** |
| 4 | 87,458 / 93,385 | 81,664 / 84,612 | 8 / 8 | 10 / 17 |
| 5 | 87,303 / 93,205 | 81,824 / 84,787 | 8 / 8 | 10 / 17 |

`gap≤3` es el menor límite que alcanza el mejor resultado seguro en ambos GT.
Sobre el replay completo rellena 122 huecos con 225 observaciones sintéticas.
`gap≤4` no agrega beneficio en los intervalos revisados y `gap≤5` mejora GT2
pero empeora HOTA e IDF1 en GT1.

## Guardrail nuevo

`validate_interpolation_policy.py` consume los JSON oficiales de TrackEval y
exige, secuencia por secuencia:

- HOTA e IDF1 sin regresión;
- IDSW sin aumento;
- fragmentaciones sin aumento;
- mismas etiquetas y secuencia entre control y candidato.

El guardrail acepta `gap≤3` y rechaza `gap≤5`. Evita ocultar una regresión de
una ventana detrás de la mejora de otra.

## Decisión

Se conserva `gap≤3` como candidato opt-in para dos etapas. No se cambia el
pipeline por defecto: los incrementos son reales pero pequeños y ambos GT
provienen del mismo partido. Las cajas interpoladas siguen siendo sintéticas y
no deben confundirse con detecciones ni alimentar eventos sin esa marca.

La evaluación fue replay de la caché persistida, no inferencia neuronal nueva.
Verificación local: 151/151 tests; entorno mínimo, 138 correctos y 13 omisiones
opcionales.

Siguiente prioridad: atribuir los ocho IDSW restantes de dos etapas en QC-v2 y
probar una sola mejora de asociación para el contacto 217/222.
