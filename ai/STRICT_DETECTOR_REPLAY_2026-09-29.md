# Replay estricto del detector — 29/09/2026

## Problema

Las primeras cachés registraban `model: yolo11n.pt`, pero el nombre del archivo no prueba que dos runtimes usen exactamente los mismos pesos. Para una comparación MOT reproducible esto es insuficiente: una descarga distinta con el mismo nombre podría producir otra caché y contaminar un A/B.

## Modo estricto

`run_fixture.py` acepta ahora `--expected-model-sha256`.

Cuando se usa:
- `--model` debe apuntar a un archivo local existente;
- el SHA256 se calcula **antes** de iniciar Ultralytics/inferencia;
- un hash distinto bloquea la corrida;
- el hash verificado se guarda también en `detections.meta.json`;
- al hacer replay, la metadata completa debe coincidir o la caché se rechaza.

Sin `--expected-model-sha256` se conserva el comportamiento histórico y Ultralytics puede resolver el nombre del modelo normalmente.

Para la corrida real Ferro–N. S. de Luján usada por las comparaciones actuales, el peso registrado fue:

`0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`

Ejemplo de regeneración estricta a confianza 0,10:

```bash
cd ai
python run_fixture.py \
  --video /ruta/fixture120.mp4 \
  --model /ruta/yolo11n.pt \
  --expected-model-sha256 0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1 \
  --cache /ruta/detections_conf010.jsonl \
  --out /ruta/cache_generation_check \
  --detector-confidence 0.10 \
  --max-missed 30
```

El objetivo de esta corrida no es elegir tracker; es producir una caché detectora cuya identidad pueda demostrarse. Después se usa `run_tracker_ab_experiment.py` para control/candidato y retención automática de GT, seguido de `evaluate_tracker_ab_experiment.py` para TrackEval y guardrail.

## Tests

Se cubren:
- aceptación del hash exacto;
- rechazo de pesos distintos;
- rechazo de hash mal formado;
- requisito de archivo local en modo estricto;
- compatibilidad del modo no estricto con el comportamiento anterior.

No se incluyen pesos en Git ni se modifica producción.
