# Bundle estricto para TrackEval

Se agregó `prepare_trackeval_bundle.py` para convertir una tarea completamente
revisada y las salidas JSONL de baseline, dos etapas y ByteTrack al mismo layout
MOTChallenge. No calcula métricas por sí mismo ni transforma propuestas en
ground truth.

## Protocolo de revisión

La revisión del intervalo debe cubrir los 105 frames. Debe anotar a todos los
jugadores de campo y arqueros visibles en cancha, excluir árbitros, banco,
personal y público, mantener una identidad sólo cuando sea verificable y usar
una nueva ante una reaparición ambigua. Las cajas representan el cuerpo
completo estimado; `visibility` registra la fracción visible entre 0 y 1.

`gt/gt.txt` usa nueve columnas MOT:

```text
frame,id,x,y,width,height,mark,class,visibility
```

El exportador exige `mark=1`, `class=1`, visibilidad válida, cajas dentro de la
imagen, un ID como máximo una vez por frame y frames relativos 1–105. Además
requiere `gt/review.json` con esta forma:

```json
{
  "status": "HUMAN_REVIEW_COMPLETE",
  "task_manifest_sha256": "<sha256 de manifest.json>",
  "gt_sha256": "<sha256 de gt/gt.txt>",
  "reviewed_frames": 105,
  "reviewed_by": "<revisor>",
  "reviewed_at": "<fecha ISO-8601 con zona horaria>"
}
```

La constancia hace detectables ediciones posteriores y declara el alcance, pero
no prueba por sí sola la calidad del etiquetado.

## Validación ejecutada

- Suite completa con runtime de visión: 84/84 tests aprobados.
- Entorno CI mínimo: 84 tests, 76 aprobados y 8 omisiones opcionales esperadas.
- Fixture sintético de dos frames: se generaron GT, seqmap y un tracker con dos
  filas en el layout esperado. Esto valida conversión, no precisión.
- Tarea real Ferro–N. S. de Luján: rechazada antes de crear salida porque aún no
  existen `gt/gt.txt` y `gt/review.json`. El seed no fue renombrado ni evaluado.

La salida se genera en:

```text
gt/mot_challenge/7metros-train/ferro_lujan_contact/gt/gt.txt
gt/mot_challenge/7metros-train/ferro_lujan_contact/seqinfo.ini
gt/mot_challenge/seqmaps/7metros-train.txt
trackers/mot_challenge/7metros-train/<tracker>/data/ferro_lujan_contact.txt
```

Según la [interfaz oficial de TrackEval](https://github.com/JonathonLuiten/TrackEval/blob/master/scripts/run_mot_challenge.py),
una vez que haya GT revisado se ejecuta:

```bash
python /ruta/TrackEval/scripts/run_mot_challenge.py \
  --GT_FOLDER /ruta/bundle/gt/mot_challenge \
  --TRACKERS_FOLDER /ruta/bundle/trackers/mot_challenge \
  --BENCHMARK 7metros --SPLIT_TO_EVAL train \
  --DO_PREPROC False --METRICS HOTA CLEAR Identity
```

Se desactiva el preprocesamiento porque es un benchmark personalizado sin clases
MOTChallenge de distractores. La implementación oficial expone HOTA, CLEAR e
Identity; los resultados reales siguen pendientes del GT completo.

## Siguiente prioridad

Completar y revisar independientemente el GT del contacto; luego ejecutar
TrackEval sobre el bundle común y comparar HOTA, IDF1, MOTA, recall y cambios de
ID. Hasta entonces, las métricas de continuidad existentes siguen siendo sólo
salud del tracker.
