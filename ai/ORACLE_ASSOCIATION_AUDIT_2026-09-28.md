# Auditoría oráculo de asociación — 28/09/2026

## Pregunta

Después del GT2 QC-v2, `two_stage` conserva ocho ID switches y el contacto 217/222 sigue siendo el caso de identidad más difícil. Antes de agregar ReID se aisló la asociación del detector: se alimentó al tracker con las cajas humanas como detecciones perfectas, ocultando los IDs GT y ordenando cada frame sólo por geometría.

Esto no es TrackEval ni estima accuracy real. Responde únicamente si la lógica de asociación actual falla cuando detección/localización son perfectas.

## Resultado local reproducible

Se usaron los dos GT humanos. En GT2 se aplicaron las dos correcciones QC ya documentadas antes del replay (`21→215` en task frame 13 y swap recíproco 217/222 en task frame 3).

Con `CentroidTracker(max_missed=30)`:

| modo | GT1 IDSW oráculo | GT2 IDSW oráculo | GT2 IDSW sólo 217/222 |
|---|---:|---:|---:|
| greedy actual | 2 | 1 | **0** |
| global | **0** | 1 | **0** |

El único switch oráculo de GT2, tanto greedy como global, ocurre en task frame 90 para GT ID 212; no pertenece al contacto 217/222.

## Interpretación

El tracker actual puede mantener 217/222 cuando recibe las cajas humanas correctas. Por lo tanto, los swaps observados en el replay detector+tracker no se explican por una incapacidad geométrica inevitable del asociador: dependen de detecciones/localizaciones imperfectas, huecos o cajas mezcladas durante el contacto.

La asignación global elimina dos switches oráculo del GT1, pero ya había mostrado beneficios mínimos en tracking real y no se promueve por esta prueba aislada. Tampoco se agrega una penalización de apariencia/forma sin medirla sobre las detecciones reales.

## Cambio de herramienta

Se agregó `audit_oracle_association.py` para repetir esta separación de causas sobre cualquier GT MOT. La herramienta:

- elimina identidad de las detecciones entregadas al tracker;
- ordena por geometría para evitar fuga de ID por orden de entrada;
- permite greedy/global;
- permite limitar el diagnóstico a identidades concretas;
- reporta switches y eventos, marcado explícitamente como diagnóstico oráculo.

## Decisión

No integrar ReID ni una regla especial 217/222 todavía. El siguiente experimento debe actuar sobre la calidad/estabilidad de las detecciones del contacto (cajas fusionadas, localización y baja confianza) y medirse con los dos GT oficiales. La evidencia oráculo evita sobreajustar el asociador a un problema que desaparece con observaciones correctas.
