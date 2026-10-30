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
