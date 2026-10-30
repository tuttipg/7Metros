# Medición reproducible: pelota, posesión y CONTROL CHANGE — 29/10/2026

Estado: fuente confirmada, scope limitado, no nuevo modelo ni inferencia. PR Draft; sin producción.

- GT semántico humano: frames 145–164 (20 frames). Evento humano: frame 164, cambio entre compañeros. Predicción histórica: frame 151, cambio entre rivales. Con tolerancia de 2 frames y clases exactas, TP=0, FP=1, FN=1; precision=recall=F1=0% **sólo en este intervalo**.
- Pelota: muestra revisada independiente de 53 positivos y 60 negativos, IoU >= 0.5, desde evidence/ball/handball_v2_yolo11n_e5_comparison_2026-10-03.json. Baseline YOLO11n strong: 24 TP, 3 FP, 29 FN; P=88.89%, R=45.28%, F1=60.00%. YOLO11n+court guard+dos etapas: 33 TP, 1 FP, 20 FN; P=97.06%, R=62.26%, F1=75.86%. Fine-tune handball v2+dos etapas: 16 TP, 29 FP, 37 FN; P=35.56%, R=30.19%, F1=32.65%.
- Posesión: **NO calculable**. Hay GT humano confirmado de 20 frames, pero el PR no conserva una salida fuente-matched frame por frame con mapping de IDs para ese intervalo. Los totales antiguos de POS? de 105 frames no sirven para establecer TP/FP/FN.
- Los frames 326–340 del gol no son negativos de pelota: fueron marcados ambiguos.
- No afirmar precisión del partido completo ni promover modelos, tracking o clasificación con esta evidencia de un partido.

Reproducción desde raíz del repositorio (no ejecuta inferencia):

    PYTHONPATH=ai python ai/score_reviewed_semantics.py --gt ai/evidence/semantic/ferro_lujan_semantic_pilot_145_164_2026-10-06.json --candidate-evidence ai/evidence/ball/event_candidates_gt1_2026-10-01.json --ball-comparison ai/evidence/ball/handball_v2_yolo11n_e5_comparison_2026-10-03.json --output /tmp/7metros_reviewed_semantic_scoring.json

La siguiente medición de posesión requiere regenerar y retener sus 20 predicciones exactas más correspondencia de IDs verificada.


## Nueva ejecución reproducible de POS? (29/10/2026)

Se reconstruyó un clip FFV1 de 180 cuadros de la fuente original desde su frame 900, con 180/180 decodificaciones pixel-idénticas. Se ejecutó el código HEAD 1d3c7093 con YOLO11n SHA 0ebbc80d..., Ultralytics 8.4.163, tracker two_stage y los módulos reales de continuidad de pelota y POS?. Se conservaron hashes y los 20 estados frame a frame en ai/evidence/semantic/possession_replay_145_164_2026-10-29.json.

El GT confirma control en 145–147 y 164. Las predicciones indican control en 148–149, 151–155 y 161. Resultado CONTROLADO vs NO CONTROLADO de ESTE piloto: TP=0, FP=8, FN=4, precision=0%, recall=0%, F1=0%. No se mide identidad del poseedor: track_id != player_gt_id. Antes de esta nueva ejecución la métrica era null por ausencia de stream retenido; el nuevo replay resuelve esa falta exclusivamente en 145–164.

El stream nuevo reproduce un CONTROL CHANGE? opositor en frame 151, pero el GT humano confirma cambio entre compañeros en 164. Se mantiene el resultado TP=0, FP=1, FN=1, F1=0% en esta ventana. No aplicar conclusiones a partidos completos.

La heurística de POS? se conserva como experimental; esta muestra demuestra que no puede alimentar estadísticas oficiales. La corrección de equipos desconocidos protege clasificación, pero no explica ni corrige por sí misma el error 151.

Reproducir con el flag --possession-replay apuntando al JSON de evidencia; se valida hash original, offset y 20 frames completos. No se tocaron Supabase ni producción.
