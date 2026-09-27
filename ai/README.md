# 7Metros AI — baseline v1

Primer baseline ejecutable de visión por computadora para 7Metros.

## Estado real

Este módulo **no afirma que exista un modelo entrenado específicamente para handball**. La primera etapa usa un detector genérico de personas de Ultralytics como adaptador opcional y un tracker determinista propio como baseline. Su objetivo es fijar un flujo reproducible y un contrato de datos estable antes de incorporar datasets, modelos y trackers más fuertes.

## Qué hace hoy

- Lee un video local con OpenCV.
- Detecta personas mediante un modelo Ultralytics configurable.
- Asigna IDs persistentes con un tracker determinista que usa centroide, IoU, compatibilidad semántica y predicción de velocidad constante.
- Puede clasificar equipos con un baseline conservador de color de camiseta; los casos ambiguos permanecen como `unknown` en vez de forzar una etiqueta.
- Incluye una calibración automática, determinista y sin entrenamiento que estima dos referencias de camiseta a partir de muestras RGB no etiquetadas del propio partido.
- Escribe un JSONL por frame con `track_id`, bounding box, confianza, centro, velocidad estimada y equipo opcional.
- Puede producir un MP4 anotado con bounding boxes, confianza e IDs persistentes para inspección visual cuadro a cuadro.
- Devuelve métricas del procesamiento y salud del tracking: observaciones por track, span medio, tracks de un solo frame, tasa de IDs nuevos cada 100 frames y cobertura de etiquetas de equipo.
- Mantiene tests del tracker, métricas, visualización, clasificación/calibración de color y contrato de salida sin requerir GPU.

## Instalación

```bash
cd ai
python -m venv .venv
# activar el entorno según el sistema operativo
pip install -e ".[vision]"
```

## Ejecución

Salida de datos:

```bash
7metros-ai --video partido.mp4 --output-jsonl artifacts/tracks.jsonl
```

Salida de datos + video anotado:

```bash
7metros-ai \
  --video partido.mp4 \
  --output-jsonl artifacts/tracks.jsonl \
  --output-video artifacts/annotated.mp4
```

Para una prueba corta:

```bash
7metros-ai --video partido.mp4 --output-jsonl artifacts/tracks.jsonl --output-video artifacts/annotated.mp4 --max-frames 300
```

La salida de consola incluye `tracking_metrics`. Estas métricas sirven para comparar configuraciones o trackers sobre exactamente el mismo video, pero **no equivalen a métricas de identidad como IDF1/HOTA** porque todavía no existe ground truth anotado verificado.

## Clasificación y calibración de equipos por color

`JerseyColorTeamClassifier` recibe referencias RGB por equipo. El clasificador toma una región central del torso, calcula un color representativo robusto y compara cromaticidad para reducir sensibilidad a cambios de iluminación. Si la muestra queda demasiado lejos de las referencias o la diferencia entre los dos mejores candidatos es pequeña, devuelve `None`.

`fit_team_color_references(samples)` permite obtener dos referencias iniciales sin cargarlas manualmente: toma muestras RGB no etiquetadas, inicializa los dos grupos con el par cromáticamente más distante y aplica una agrupación iterativa determinista en espacio de cromaticidad. Rechaza entradas insuficientes, clusters colapsados o dos familias de color demasiado similares, en vez de inventar una separación falsa. Las etiquetas resultantes (`team_a`/`team_b` por defecto) son estables pero todavía no equivalen por sí solas a identidad semántica local/visitante; esa asociación deberá venir de contexto del partido o una señal adicional.

Este baseline no sustituye un clasificador aprendido. Su objetivo inmediato es aportar una señal reproducible y segura al tracker, que ya evita asociaciones incompatibles cuando ambos lados conocen el equipo.

## Contrato `7metros-ai.v1`

Cada línea del JSONL representa un frame y contiene: versión de esquema, índice y timestamp del frame, tamaño de imagen y objetos con `track_id`, tipo, confianza, bounding box, centro, velocidad estimada y equipo opcional.

El contrato puede ampliarse sin romper los campos base con `team`, `player_id`, `court_xy`, `possession`, eventos y pelota.

## Tests

```bash
cd ai
python -m unittest discover -s tests -v
```

## Comparación reproducible de trackers

Con una caché creada a confianza `0.10`, el comparador reproduce exactamente
las mismas cajas y el mismo filtro del fixture para: baseline sólo fuerte
(`>=0.25`), baseline experimental de dos etapas y ByteTrack estándar de
Ultralytics. Es replay de caché, no inferencia nueva ni medición de precisión.

```bash
pip install -e '.[benchmark]'
python benchmark_trackers.py \
  --video /ruta/fixture120.mp4 \
  --cache /ruta/detections_010.jsonl \
  --out /ruta/comparison
```

El resultado guarda `comparison.json` y un JSONL por tracker. Todos incluyen
el hash del video y la configuración. Sin ground truth completo, las métricas
de continuidad y fragmentación no equivalen a IDF1, HOTA o accuracy.

El tamaño de entrada del detector queda explícito y forma parte de la identidad
de caché cuando se usa, por ejemplo, `--detector-image-size 1280` en
`run_fixture.py`. El default histórico no cambia. Para medir costo y cobertura
en contactos con inferencia nueva en ambas configuraciones:

```bash
python benchmark_detector_resolution.py --video /ruta/fixture120.mp4 \
  --model /ruta/yolo11n.pt --output /ruta/benchmark_resolucion \
  --range 105:210 --range 1065:1155 \
  --reference fixtures/ferro_lujan_crossing_points.json \
  --reference fixtures/ferro_lujan_second_contact.json \
  --baseline-size 640 --candidate-size 1280
```

Los puntos dispersos sólo diagnostican cajas compartidas o duplicadas; no son
ground truth ni permiten calcular precisión o recall.

Para auditar visualmente un episodio, se pueden superponer de dos a cuatro
salidas sincronizadas sobre los mismos frames y reproducirlas en cámara lenta:

```bash
python compare_trackers_video.py --video /ruta/fixture120.mp4 \
  --tracks 'Baseline=/ruta/baseline_high_only.jsonl' \
  --tracks 'Dos etapas=/ruta/two_stage.jsonl' \
  --tracks 'ByteTrack=/ruta/bytetrack_standard.jsonl' \
  --output /ruta/contacto.mp4 --start 3.5 --seconds 3.5 --slowdown 2
```

Para preparar una tarea de anotación completa del mismo episodio:

```bash
python prepare_mot_annotation.py --video /ruta/fixture120.mp4 \
  --tracks /ruta/two_stage.jsonl --output /ruta/tarea_contacto \
  --start 3.5 --seconds 3.5
```

La carpeta incluye los frames, `seqinfo.ini`, el mapeo al video fuente y
`seed/seed.txt`. El seed es sólo una propuesta automática: el exportador lo
marca como no verificado y nunca crea `gt/gt.txt`. Las métricas MOT quedan
prohibidas hasta corregir cajas, ausencias e identidades en todos los frames.

Para empezar la revisión por los cuadros donde los trackers más difieren, sin
confundir consenso automático con ground truth:

```bash
python prepare_mot_review_queue.py --task /ruta/tarea_contacto \
  --tracks baseline=/ruta/baseline_high_only.jsonl \
  --tracks two_stage=/ruta/two_stage.jsonl \
  --tracks bytetrack=/ruta/bytetrack_standard.jsonl \
  --output /ruta/review_queue.json
```

También genera `review_queue.csv`. La cola sólo ordena el trabajo: los cuadros
con puntaje cero siguen requiriendo revisión humana completa.

Después de una revisión humana completa y registrada en `gt/review.json`, el
bundle común para TrackEval se construye así:

```bash
python prepare_trackeval_bundle.py --task /ruta/tarea_contacto \
  --tracks Baseline=/ruta/baseline_high_only.jsonl \
  --tracks TwoStage=/ruta/two_stage.jsonl \
  --tracks ByteTrack=/ruta/bytetrack_standard.jsonl \
  --output /ruta/trackeval_bundle
```

El comando rechaza automáticamente el seed sin revisar, hashes de revisión
obsoletos, frames faltantes, cajas inválidas e IDs duplicados. La estructura y
el comando oficial de TrackEval están documentados en
`TRACKEVAL_BUNDLE_2026-09-27.md`. La validación estructural no demuestra que la
revisión humana sea correcta.

Los tests verifican persistencia de ID, recuperación tras frames perdidos, continuidad con movimiento rápido, cruces con bloqueo semántico, serialización estable, métricas de tracking, visualización y clasificación de equipos. La calibración automática tiene regresiones para dos familias de camiseta bajo cambios fuertes de brillo, reproducibilidad al invertir el orden de entrada y rechazo de una única familia de color.

Estos tests forman parte de `.github/workflows/validate.yml`, por lo que el PR falla si se rompe el baseline o su contrato.

## Limitaciones conocidas

- El detector genérico de personas no está ajustado a handball.
- El tracker baseline no reemplaza ByteTrack/BoT-SORT ni resuelve todas las oclusiones complejas.
- La clasificación por color puede quedar ambigua con camisetas similares, sombras, chalecos o arqueros con indumentaria distinta.
- La calibración automática estima dos familias cromáticas, pero todavía no decide cuál es local/visitante y no filtra por sí sola árbitros o arqueros con camisetas diferenciadas.
- Las métricas actuales miden salud/churn del tracker y cobertura de equipo; sin anotación humana no permiten afirmar precisión de identidad o clasificación.
- Aún no hay detección de pelota, clasificación específica de arqueros, coordenadas de cancha ni eventos.
- La precisión real sobre partidos FEMEBAL no se puede afirmar sin un video de prueba accesible al runtime.
- Los pesos de Ultralytics pueden requerir descarga la primera vez.

## Próximos hitos

1. incorporar un video de prueba descargable de forma reproducible;
2. integrar la calibración automática al arranque del pipeline con filtrado de árbitros/arqueros;
3. medir detecciones, estabilidad de IDs y cobertura de equipo sobre handball real y revisar el MP4 anotado;
4. sustituir/comparar el tracker baseline con ByteTrack/BoT-SORT;
5. añadir detector de pelota separado y coordenadas de cancha;
6. agregar eventos de posesión, lanzamiento y gol sobre señales verificables.
