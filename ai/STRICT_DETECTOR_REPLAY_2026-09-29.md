# Replay estricto del detector — 29/09/2026

## Problema

Las primeras cachés registraban `model: yolo11n.pt`, pero el nombre del archivo no prueba que dos runtimes usen exactamente los mismos pesos. Para una comparación MOT reproducible esto es insuficiente: una descarga distinta con el mismo nombre podría producir otra caché y contaminar un A/B.

## Modo estricto

`run_fixture.py` acepta `--expected-model-sha256`.

### Generación de una caché nueva

- `--model` debe apuntar a un archivo local existente;
- el SHA256 se calcula **antes** de iniciar Ultralytics/inferencia;
- un hash distinto bloquea la corrida;
- el hash verificado se guarda en `detections.meta.json`;
- la identidad portable del modelo es `basename + SHA256`, no la ruta absoluta de una máquina.

### Replay de una caché existente

- no hace falta conservar el binario `.pt`, porque no se ejecuta inferencia;
- el SHA esperado se compara contra `model_sha256` de la metadata;
- si además se proporciona un archivo local, también se hashea y debe coincidir;
- video, nombre portable del modelo, hash, confianza y tamaño de inferencia deben coincidir con la metadata o la caché se rechaza.

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

El objetivo de esa corrida no es elegir tracker; es producir una caché detectora cuya identidad pueda demostrarse. Después se usa `run_tracker_ab_experiment.py` para control/candidato y retención automática de GT, seguido de `evaluate_tracker_ab_experiment.py` para TrackEval y guardrail.

## Tests

Se cubren:
- aceptación del hash exacto;
- rechazo de pesos distintos;
- rechazo de hash mal formado;
- requisito de archivo local para **nueva inferencia** estricta;
- replay estricto sin binario local cuando la metadata ya registra el hash;
- rechazo de un binario local incorrecto incluso durante replay;
- compatibilidad del modo no estricto con el comportamiento anterior.

No se incluyen pesos en Git ni se modifica producción.
