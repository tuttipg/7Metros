# TrackEval A/B reproducible y guardrail genérico — 29/09/2026

El runner `evaluate_tracker_ab_experiment.py` completa el flujo iniciado por `run_tracker_ab_experiment.py`. Consume únicamente el manifest del experimento, los slices retenidos y las tareas GT humanas; no necesita recuperar nuevamente los JSONL completos de 3.600 cuadros.

Por cada tarea humana y por cada rama (`control` / `candidate`):

1. valida la constancia humana de la tarea;
2. localiza el slice retenido que cubre sus source frames;
3. verifica SHA256 antes de usarlo;
4. construye un bundle MOTChallenge con `prepare_trackeval_bundle.py`;
5. ejecuta TrackEval oficial mediante `evaluate_trackeval_bundle.py`;
6. conserva hashes de resultado y bundle.

Al final `validate_mot_candidate.py` aplica un guardrail por secuencia al tracker bajo prueba. El candidato sólo se considera verificable si, en **cada** GT revisado:
- HOTA no baja;
- IDF1 no baja;
- IDSW no aumenta;
- fragmentaciones no aumentan.

No se compensan regresiones de una secuencia con mejoras en otra.

Ejemplo posterior al A/B con caché 0,10:

```bash
cd ai
python evaluate_tracker_ab_experiment.py \
  --experiment-manifest /ruta/ab_ambiguous_motion/experiment_manifest.json \
  --task gt1=/ruta/contact_task_revisada \
  --task gt2=/ruta/hard_reentry_task_qc_v2 \
  --output /ruta/ab_ambiguous_motion_eval \
  --tracker two_stage
```

La infraestructura no modifica el tracker ni promueve automáticamente el experimento. Si el guardrail devuelve `MOT_CANDIDATE_REJECTED`, la guardia de movimiento debe descartarse o seguir aislada; si devuelve `MOT_CANDIDATE_VERIFIED_ACROSS_REVIEWED_GT`, todavía se mantiene la limitación de que ambos GT pertenecen al mismo partido.
