# 7Metros AI — visión por computadora

Pipeline experimental y reproducible para analizar handball real en 7Metros.

## Estado real — 29/09/2026

Este módulo ya superó la etapa puramente sintética. Existe validación sobre el partido real **Ferro–N. S. de Luján** y dos intervalos con ground truth humano revisado. Sigue siendo investigación experimental: dos recortes de un mismo fixture **no** permiten afirmar precisión general sobre otros partidos, clubes, cámaras o canchas.

Componentes actuales:

- YOLO11n/person como detector de control;
- caché de detecciones para comparar trackers sobre exactamente las mismas cajas;
- tracker determinista propio con centroide, IoU, predicción de velocidad y compatibilidad semántica;
- asociación conservadora de dos etapas para cajas de confianza `0.10–0.25`;
- ByteTrack estándar de Ultralytics como control externo;
- clasificación de equipo/roles específica del fixture;
- filtro temporal opt-in de árbitros sobre salida, sin eliminarlos del estado interno del tracker;
- JSONL `7metros-ai.v1` y MP4 anotado;
- TrackEval 1.3.0, HOTA/CLEAR/Identity;
- importación/validación de GT humano, auditorías por frame e identidad y guardrails;
- interpolación experimental corta de huecos, siempre marcada como sintética;
- retención automática de slices GT para no perder evidencia reproducible;
- guardia experimental ante cajas fusionadas, apagada por defecto.

No hay todavía detector específico de pelota, identidad por dorsal, coordenadas métricas de cancha, posesión ni eventos automáticos confiables.

## Resultados oficiales actuales

### GT1 — contacto

Fixture frames `105–209`, 105 frames, 1.359 anotaciones humanas y 13 identidades. TrackEval 1.3.0 con filtro temporal uniforme de roles:

| Tracker | HOTA | IDF1 | MOTA | TP | FN | FP | IDSW | Frag |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline ≥0.25 | 85.939 | 90.678 | 83.738 | 1154 | 205 | 8 | 8 | 19 |
| **dos etapas 0.10/0.25** | **87.437** | **93.380** | **88.374** | **1224** | **135** | 15 | 8 | **12** |
| ByteTrack estándar | 74.719 | 86.693 | 88.006 | 1206 | 153 | **5** | **5** | 16 |

### GT2 — reentrada difícil, QC-v2

Fixture frames `2915–3004`, 90 frames, 1.125 anotaciones y 13 identidades. El QC-v2 corrigió un único swap humano recíproco 217↔222 en task frame 3 antes del rerun oficial.

| Tracker | HOTA | IDF1 | MOTA | TP | FN | FP | IDSW | Frag |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline ≥0.25 | 79.884 | 82.990 | 77.067 | 917 | 208 | 45 | **5** | 28 |
| **dos etapas 0.10/0.25** | **81.319** | **84.284** | **79.733** | **959** | **166** | 54 | 8 | **20** |
| ByteTrack estándar | 69.675 | 80.914 | 76.444 | 923 | 202 | 53 | 10 | 22 |

`two_stage` lidera HOTA e IDF1 en ambos GT humanos y se mantiene como candidato principal. Eso no lo convierte todavía en default productivo ni demuestra generalización.

## Instalación

```bash
cd ai
python -m venv .venv
# activar el entorno según el sistema operativo
pip install -e ".[vision,benchmark]"
```

Los tests dependency-light siguen funcionando sin toda la pila opcional:

```bash
python -m unittest discover -s tests -v
```

## Pipeline básico

Salida JSONL:

```bash
7metros-ai --video partido.mp4 --output-jsonl artifacts/tracks.jsonl
```

JSONL + MP4 anotado:

```bash
7metros-ai \
  --video partido.mp4 \
  --output-jsonl artifacts/tracks.jsonl \
  --output-video artifacts/annotated.mp4
```

Cada línea de `7metros-ai.v1` representa un frame e incluye índice/timestamp, tamaño de imagen y objetos con `track_id`, bbox, confianza, centro, velocidad estimada, equipo opcional y rol cuando existe evidencia.

`track_id` es una identidad temporal del tracker, **no** un `player_id` real.

## Fixture real de control

Fuente histórica aportada por Tomás:

- `20260926-1444-24.0816290.mp4`;
- fuente: 374,7333 s, 936×524, 30 FPS;
- recorte usado: segundos 30–150, 120 s / 3.600 frames;
- SHA256 fuente: `84a94f6e5526d94afc67dc8ee99cc9b390265482d6f0250f2d8a12080e437ed2`;
- SHA256 `fixture120.mp4`: `7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d`;
- SHA256 pesos YOLO11n usados: `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`;
- Ultralytics histórico: 8.4.163.

Comando histórico de recorte:

```bash
ffmpeg -ss 30 -i original.mp4 -t 120 -an -c:v libx264 -preset fast -crf 20 fixture120.mp4
```

El hash del archivo final sigue siendo la verificación autoritativa; una versión distinta de FFmpeg/x264 puede producir bytes distintos aun usando la misma línea de comando.

## Caché detectora estricta

Para una comparación nueva no alcanza con que el archivo se llame `yolo11n.pt`. `run_fixture.py` puede verificar el binario **antes** de inferencia:

```bash
python run_fixture.py \
  --video /ruta/fixture120.mp4 \
  --model /ruta/yolo11n.pt \
  --expected-model-sha256 0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1 \
  --cache /ruta/detections_conf010.jsonl \
  --out /ruta/cache_check \
  --detector-confidence 0.10 \
  --max-missed 30
```

En modo estricto `--model` debe ser un archivo local. El hash validado queda incorporado a `detections.meta.json`; un replay posterior con video/modelo/confianza distintos se rechaza.

## Comparación reproducible de trackers

El benchmark usa la misma caché para:

- `baseline_high_only`: sólo cajas `>=0.25`;
- `two_stage`: cajas `>=0.25` + mantenimiento conservador con `0.10–0.25`;
- `bytetrack_standard`: ByteTrack estándar sobre el mismo stream `>=0.10`.

```bash
python benchmark_trackers.py \
  --video /ruta/fixture120.mp4 \
  --cache /ruta/detections_conf010.jsonl \
  --out /ruta/comparison \
  --exclude-confirmed-referees
```

Las métricas de salud del JSON no sustituyen TrackEval. HOTA/IDF1/MOTA sólo se usan cuando existe GT humano correspondiente.

## A/B que no pierde evidencia

Para experimentos que puedan respaldar una decisión, usar preferentemente:

```bash
python run_tracker_ab_experiment.py \
  --video /ruta/fixture120.mp4 \
  --cache /ruta/detections_conf010.jsonl \
  --output /ruta/ab_ambiguous_motion \
  --exclude-confirmed-referees \
  --ambiguity-iou 0.30
```

Este runner ejecuta control + candidato y **retiene automáticamente** los JSONL de los rangos humanos actuales:

- GT1: `105:210` end-exclusive;
- GT2: `2915:3005` end-exclusive.

Genera hashes de video, caché, metadata, outputs completos, slices y manifests. Así una corrida futura no puede quedar sólo con métricas agregadas sin las cajas necesarias para reevaluar.

## TrackEval A/B + guardrail

Con las tareas humanas disponibles:

```bash
python evaluate_tracker_ab_experiment.py \
  --experiment-manifest /ruta/ab_ambiguous_motion/experiment_manifest.json \
  --task gt1=/ruta/contact_task_revisada \
  --task gt2=/ruta/hard_reentry_task_qc_v2 \
  --output /ruta/ab_ambiguous_motion_eval \
  --tracker two_stage
```

El runner valida hashes, arma bundles MOTChallenge, ejecuta TrackEval oficial y aplica `validate_mot_candidate.py`.

Un candidato sólo pasa el guardrail si **en cada secuencia**:

- HOTA no baja;
- IDF1 no baja;
- IDSW no aumenta;
- fragmentaciones no aumentan.

Una mejora grande en un GT no puede ocultar una regresión en el otro.

## Admisión de modelos especializados de pelota

Antes de ejecutar un checkpoint externo, `admit_ball_model.py` exige un manifest
de procedencia v1, verifica el SHA-256 antes de deserializar, licencia y fuentes
de entrenamiento, exclusión explícita del video held-out y que el checkpoint sea
`detect` de una sola clase con el ID/nombre declarados:

```bash
python admit_ball_model.py \
  --model handball.pt \
  --provenance handball.provenance.json \
  --evaluation-video-sha256 SHA256_DEL_VIDEO \
  --output admission.json
```

El estado `ADMITTED_FOR_HELDOUT_EVALUATION_NOT_ACCURACY` habilita únicamente el
benchmark; no afirma precisión. Un `.pt` de PyTorch debe provenir además de una
fuente confiable, porque cargar checkpoints no confiables puede ejecutar código.

El benchmark permite replay fail-closed aunque el binario admitido ya no esté
localmente disponible: `--expected-model-sha256` debe coincidir con la fuente
de la caché y con el archivo si éste existe. La guardia experimental
`--max-detection-side-fraction` limita el ancho o alto de una caja como fracción
del lado corto del cuadro. Está desactivada por defecto; cualquier valor debe
validarse en datos independientes antes de cambiar producción.

Los 113 cuadros reservados para evaluar pelota tienen además una huella de
píxeles reproducible. Se regenera únicamente con el MP4 cuyo hash coincide con
la caché v2:

```bash
python build_ball_holdout_manifest.py \
  --video fixture120.mp4 \
  --detection-cache evidence/ball/yolo11n_ball_gt_cache_v2_runtime_002_960_2026-10-03.json \
  --output evidence/ball/ball_holdout_pixel_manifest.json
```

Esta lista permite rechazar copias pixel-idénticas en futuros datasets de
training. No detecta por sí sola cuadros recortados o recodificados.

La variante perceptual agrega dHash/pHash con umbrales fijos, medidos sobre los
113 cuadros reales, para bloquear también copias JPEG o redimensionadas:

```bash
python build_ball_holdout_manifest.py \
  --video fixture120.mp4 \
  --detection-cache evidence/ball/yolo11n_ball_gt_cache_v2_runtime_002_960_2026-10-03.json \
  --perceptual \
  --output evidence/ball/ball_holdout_perceptual_manifest.json
```

El match exige simultáneamente distancia dHash ≤3 y pHash ≤2. Es un guard de
contaminación conservador, no un clasificador de imágenes; no cubre recortes.

Antes de entrenar, `validate_ball_training_dataset.py` exige un dataset YOLO
local con splits `train`/`val`/`test`, una sola clase pelota, pares completos de
imagen/label, geometría normalizada válida, al menos una caja positiva de
training y ausencia de imágenes duplicadas o píxeles held-out:

```bash
python validate_ball_training_dataset.py \
  --data-yaml /ruta/dataset/data.yaml \
  --holdout-manifest evidence/ball/ball_holdout_perceptual_manifest_2026-10-03.json \
  --output /ruta/dataset-validation.json
```

El estado `STRUCTURALLY_VALID_AND_HOLDOUT_EXCLUDED_NOT_MODEL_ACCURACY` sólo
habilita el próximo paso del pipeline. No valida la calidad de las anotaciones,
la licencia del dataset ni el rendimiento de un modelo entrenado.

La licencia se controla por separado antes de descargar o entrenar. El manifest
de fuentes debe cubrir tanto el medio original como las anotaciones, registrar
atribución, URL de licencia y obligaciones. El modo `product` rechaza licencias
`NC`; una licencia desconocida también falla cerrada:

```bash
python screen_ball_training_sources.py \
  --manifest training-sources.json \
  --intended-use product \
  --output source-rights-screen.json
```

`SOURCE_RIGHTS_SCREEN_PASSED_NOT_DATASET_ADMISSION` sólo aprueba la
compatibilidad documental de esas fuentes. Todavía exige descargar, hashear y
validar el dataset; tampoco afirma calidad de labels ni precisión del modelo.

## Ground truth humano

`prepare_mot_annotation.py` convierte un intervalo y un JSONL de tracker en una tarea MOTChallenge revisable. El seed automático nunca se considera ground truth.

Después de revisión completa, `import_reviewed_gt.py` valida procedencia, frames, geometría, IDs y constancia humana. Correcciones puntuales de QC pueden declararse explícitamente, por ejemplo:

```bash
python import_reviewed_gt.py \
  --review-json final.json \
  --task /ruta/tarea \
  --expected-manifest-sha256 SHA256_DEL_MANIFIESTO \
  --id-correction 13:21:215
```

`prepare_trackeval_bundle.py` convierte GT + JSONL a MOTChallenge y `evaluate_trackeval_bundle.py` ejecuta HOTA/CLEAR/Identity con TrackEval 1.3.0.

La validación estructural demuestra integridad del formato/procedencia, no que cada anotación humana sea infalible. Por eso existe QC posterior y las métricas sensibles a identidad se rerunean si cambia el GT.

## Interpolación corta

La interpolación lineal sólo rellena huecos **internos** del mismo ID y marca cada observación como sintética.

Sobre `two_stage`, `gap≤3` es el menor límite que pasa el guardrail en ambos GT:

- GT1 HOTA/IDF1: `87.437/93.380 → 87.458/93.385`;
- GT2 QC-v2: `81.319/84.284 → 81.664/84.612`;
- IDSW no aumenta;
- fragmentaciones: `12→10` y `20→17`.

`gap≤5` fue rechazado porque mejora GT2 pero regresa HOTA/IDF1 en GT1. La interpolación sigue opt-in y no debe alimentar eventos como si fuera evidencia detectora real.

## Filtro temporal de árbitros

La clasificación de indumentaria produce candidatos de rol; `TemporalRoleFilter` exige evidencia repetida antes de excluir un oficial de la **salida**. La asociación interna sigue rastreándolo para no generar identidades nuevas constantemente.

En GT1 y GT2 las observaciones eliminadas por el filtro no coincidieron ni solaparon a IoU 0,5 con cajas GT de jugadores. Aun así permanece opt-in: ambos GT pertenecen al mismo fixture y no cubren todos los uniformes/canchas.

## Problemas separados que no deben mezclarse

### Borde superior — 205/215

En GT2:

- ID205: 78/89 matches a confianza ≥0.10 frente a 51/89 a ≥0.25: gran parte es baja confianza;
- ID215: 16/90 tanto a ≥0.10 como a ≥0.25;
- para ID215 con `y<5 px`: 0/59 incluso a 0.10.

Se probó inferencia en ROIs superiores. Recuperó cajas pero empeoró HOTA/IDF1 e incrementó IDSW de `two_stage`; fue descartada.

### Contacto denso — 217/222

- HSV/color simple funciona en frames fáciles pero falla exactamente en el cruce difícil: descartado como término de asociación;
- con cajas GT perfectas ocultando identidad, el tracker actual produce 0 swaps entre 217/222;
- con detecciones reales ≥0.25, hay una caja que solapa a ambos jugadores en 57/89 frames conjuntos a IoU≥0.20;
- los cinco IDSW restantes del baseline QC-v2 ocurren en esos frames ambiguos.

Esto apunta a interacción localización ambigua + estado temporal, no a que el asociador sea incapaz de mantener identidad con cajas limpias.

## Guardia experimental de movimiento ambiguo

`AmbiguityVelocityTracker` es una clase separada, apagada por defecto. Si una caja **fuerte** solapa ≥2 tracks visibles y compatibles, mantiene la asociación/output normal pero evita aprender una nueva velocidad desde esa caja potencialmente fusionada.

El benchmark la expone con:

```bash
--freeze-ambiguous-velocity --ambiguity-iou 0.30
```

El screening high-only mostró una señal pequeña sin pérdida de TP, pero **no** constituye TrackEval oficial de `two_stage`. La guardia sólo puede promoverse después de una corrida exacta sobre caché 0.10 y de pasar el guardrail en los dos GT. Si no lo hace, se elimina.

## Experimentos descartados

- aumentar sólo `max_missed`: menos IDs totales pero sin mejora real de continuidad;
- asociación global básica: sin mejora material;
- histogramas HSV simples para 217/222: fallan en el evento crítico;
- crops/ROI de borde superior: más recall pero peor tracking;
- rescate global de duplicados: más falsos positivos de los aceptables;
- interpolación >3 como política actual: `gap≤5` regresa GT1;
- suprimir/diferir directamente una caja fuerte sólo por ambigüedad: reduce algunos switches pero pierde demasiado recall.

## Limitaciones conocidas

- YOLO11n COCO/person no está ajustado a handball;
- los dos GT humanos pertenecen al mismo partido;
- persisten fusiones de cajas durante contactos/oclusiones;
- `two_stage` reduce pérdidas pero todavía fragmenta identidades difíciles;
- clasificación de equipos/roles es específica del fixture y no equivale a identificación de jugador;
- no existe todavía un benchmark humano multi-partido;
- no hay pelota, posesión, lanzamiento, gol ni coordenadas métricas confiables;
- los pesos/caché históricos grandes no se versionan en Git, por lo que los slices evaluables deben retenerse en toda corrida nueva.

## Próximos hitos

1. recuperar/regenerar la caché YOLO11n exacta a confianza 0.10 con hash de peso verificado;
2. ejecutar A/B control vs guardia de movimiento ambiguo y conservar automáticamente ambos GT;
3. TrackEval + guardrail; conservar la guardia sólo si no regresa ninguna secuencia;
4. si la guardia falla, descartarla y probar una única señal de asociación más robusta a oclusión;
5. ampliar validación a otro partido/cámara antes de convertir heurísticas fixture-specific en defaults;
6. recién con identidad/detección suficientemente estables, avanzar a cancha, pelota, posesión y eventos.

## Seguridad

El trabajo de esta rama:

- no toca Supabase;
- no habilita escrituras productivas;
- no contiene credenciales ni secretos;
- no publica pesos ni videos del partido;
- mantiene cambios experimentales como opt-in;
- permanece en PR Draft mientras la validación siga limitada.
