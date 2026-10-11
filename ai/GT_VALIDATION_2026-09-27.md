# Ground truth humano Ferro–N. S. de Luján — 27/09/2026

## Hito completado

Tomás revisó visualmente frame por frame el intervalo de contacto de 3,5–7,0 s del recorte real Ferro–N. S. de Luján. La revisión partió de propuestas automáticas recuperadas para minimizar trabajo manual, pero las cajas e identidades finales son la referencia humana.

El archivo de progreso del revisor contenía los 105 frames. Un único flag interno (`reviewed[28]`, frame de tarea 29) quedó en `false` aunque Tomás confirmó explícitamente haber revisado todos los frames; ese mismo frame contiene una anotación `human_added`, consistente con actividad de revisión. Se trató como estado obsoleto de la interfaz, no como frame omitido.

## Validación estructural

- frames: 105;
- resolución: 936×524;
- FPS: 30;
- anotaciones finales: 1.359;
- identidades finales: 13;
- IDs duplicados dentro de un frame: 0;
- cajas fuera de imagen o con geometría inválida: 0;
- formato GT: MOTChallenge de 9 columnas (`frame,id,x,y,width,height,mark,class,visibility`);
- `mark=1`, `class=1` y visibilidad dentro de `[0,1]` para todas las filas.

SHA256 del `gt.txt` final:

`6cbee6046118d3f25cc3ae028b1aaa24b75e42859f0bc2541eaab9cfdcd1b615`

SHA256 del JSON de progreso recibido:

`a2d3314b1cc36b3f15041ee67f8af7aa241cba3e94e0f2708376cbaeea3829ab`

Se reconstruyó además una tarea compatible con `prepare_trackeval_bundle.py` usando `manifest.json`, `frames.csv`, `seqinfo.ini`, `seed/seed.txt`, `gt/gt.txt` y `gt/review.json`, y se reprodujeron localmente sus validaciones de geometría, IDs, rango de frames y atestación de revisión.

## Sanity check histórico — NO TrackEval oficial

Para comprobar que el GT contiene señal de identidad útil se compararon localmente tres JSONL históricos que sí quedaron persistidos (`smooth`, `memory30`, `global30`) con IoU 0,5. Las detecciones son las mismas; sólo cambia asociación. `smooth` mostró 13 cambios de ID mientras `memory30` y `global30` mostraron 8. Esto confirma que la anotación discrimina continuidad de identidad.

Estos números no se usan para elegir el pipeline: no son la ejecución oficial de TrackEval y no corresponden al trío actual `baseline_high_only` / `two_stage` / `bytetrack_standard`.

## Bloqueo exacto para TrackEval

Los resúmenes y hashes del benchmark actual están versionados, pero los tres JSONL completos producidos por `benchmark_trackers.py` no fueron persistidos en GitHub, Library, comentarios del PR ni ZIPs de evidencia recuperados. No se pueden reconstruir HOTA, IDF1, MOTA, recall o ID switches oficiales a partir de agregados.

Por lo tanto, el siguiente paso reproducible es regenerar esos tres JSONL con el mismo video/caché/modelo y luego ejecutar `prepare_trackeval_bundle.py` + TrackEval. Hasta entonces no se declara un ganador ni se promueve un tracker por precisión.
