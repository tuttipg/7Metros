# Guardia experimental de movimiento ante cajas fusionadas — 29/09/2026

## Problema observado

La auditoría del contacto 217/222 mostró que las cinco conmutaciones de identidad restantes del baseline QC-v2 ocurren en cuadros donde existe al menos una detección que solapa simultáneamente a ambos jugadores. El oracle de asociación previo, en cambio, no intercambia 217/222 cuando recibe cajas GT perfectas. Esto apunta a la interacción entre localización ambigua y estado temporal, no a una falla inevitable del asociador con observaciones limpias.

## Experimentos negativos antes de tocar código

Se probaron offline, sobre el mismo replay high-only disponible, reglas que directamente difieren/suprimen una detección fuerte por ser ambigua entre dos tracks. Reducen algunos switches, pero pierden demasiado recall. Con IoU de ambigüedad 0,30 se pierden aproximadamente 43 TP en GT1 y 42 TP en GT2. También se probó anular el bonus IoU o exigir un margen grande entre costos; no apareció un compromiso estable entre continuidad y recall.

Se descartan esas reglas: una caja fusionada puede seguir siendo la única observación útil de una persona y no debe borrarse sólo por ambigüedad geométrica.

## Candidato conservador

Se agregó `AmbiguityVelocityTracker` como experimento opt-in. La asociación, la caja emitida y los nacimientos de track permanecen exactamente iguales al `CentroidTracker`. La única diferencia es que, si una detección **fuerte** (`confidence >= high_threshold`) solapa al menos dos tracks visibles y compatibles con IoU >=0,30, el track asociado conserva su velocidad previa en lugar de aprender movimiento desde esa caja potencialmente fusionada.

La hipótesis es más limitada: aceptar la observación actual pero evitar que una localización contaminada de dos cuerpos desplace la predicción del cuadro siguiente.

## Screening disponible — no TrackEval oficial

El runtime actual no conserva la caché detectora exacta a confianza 0,10 ni los pesos YOLO11n, por lo que todavía no puede reproducirse aquí el `two_stage` oficial. Se usó únicamente el replay high-only recuperable como screening. Ese replay local reproduce TP/FN de ambos GT pero presenta pequeñas diferencias de rol/decodificación respecto del artefacto oficial; por eso los números siguientes **no son métricas oficiales ni justifican promoción**.

Con umbral de ambigüedad 0,30:

- GT1: mismo TP/FP del control proxy; IDSW 7→6 y fragmentaciones 15→14;
- GT2 QC-v2: mismo TP/FP; IDSW 5→5 y fragmentaciones 25→25;
- otros umbrales probados no mostraron una ventaja más consistente.

## Guardrails

- clase separada; `CentroidTracker` y defaults no cambian;
- sólo cajas fuertes pueden congelar velocidad; el mantenimiento débil de dos etapas permanece intacto;
- semántica de label/equipo se respeta al decidir si dos tracks hacen ambigua una caja;
- el contador `ambiguous_velocity_freezes` permite auditar cuántas actualizaciones fueron afectadas;
- tests verifican validación de parámetros, actualización normal de velocidad, preservación de velocidad ante caja fusionada y ausencia de intervención sobre cajas débiles.

## Decisión

Mantener la guardia únicamente como candidato experimental aislado. No conectarla todavía al benchmark oficial ni al pipeline por defecto. El siguiente requisito es ejecutar baseline/two_stage con la caché persistida de confianza 0,10 y TrackEval sobre los dos GT humanos. Si no mejora HOTA/IDF1 sin aumentar IDSW/fragmentaciones en ambas secuencias, se elimina.
