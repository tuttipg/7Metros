# Validador fail-closed de dataset de pelota — 03/10/2026

## Objetivo

Conectar las 113 huellas de píxeles held-out a un bloqueo ejecutable antes de
cualquier fine-tuning. La exclusión declarada en la procedencia del modelo ya no
es suficiente por sí sola: el dataset debe demostrar que no contiene copias
pixel-idénticas de esos cuadros.

## Cambio

`validate_ball_training_dataset.py` carga un `data.yaml` YOLO y falla cerrado
salvo que:

- existan splits locales, no vacíos y separados `train`, `val` y `test`;
- haya exactamente una clase `0` reconocida como pelota;
- cada imagen tenga su label, sin labels huérfanos;
- cada fila YOLO tenga cinco campos, clase `0`, números finitos y una caja
  normalizada completamente dentro de la imagen;
- `train` incluya al menos una caja positiva;
- ninguna imagen sea byte-idéntica ni decodifique a los mismos píxeles que otra;
- todas las imágenes decodifiquen con OpenCV y ninguna huella de píxeles
  coincida con el manifest held-out v1.

El reporte exitoso fija conteos por split, hashes de imagen/label/píxeles y un
fingerprint determinista del dataset. La CLI no sobreescribe un reporte previo.

## Validación ejecutada

- **8 pruebas nuevas**: admisión determinista y rechazos por duplicado de bytes
  o píxeles entre splits, label faltante/huérfano, clase o caja inválida, training sin positivos,
  contaminación held-out y manifest inconsistente.
- Suite completa mínima: **277/277**, con 7 skips de dependencias visuales
  opcionales.
- Suite completa con runtime de visión: **277/277**, sin skips.
- Camino OpenCV real (`4.11.0`): tres imágenes decodificadas, dos cajas y un
  negativo fueron admitidos por el chequeo estructural; al insertar la huella
  decodificada de una de esas imágenes en el contrato held-out, fue rechazada.
- El mismo fixture estructural se comparó contra el manifest versionado de
  **113** huellas reales sin solapamiento.

Evidencia: `ai/evidence/ball/ball_training_dataset_validator_2026-10-03.json`.

## Interpretación y límites

El estado
`STRUCTURALLY_VALID_AND_HOLDOUT_EXCLUDED_NOT_MODEL_ACCURACY` **no es accuracy**,
no ejecuta inferencia/replay y no acredita la calidad ni la licencia de un
dataset. La prueba de integración usa imágenes de control sólo para verificar el
validador; no son datos de entrenamiento ni evaluación de un modelo.

La huella exacta no detecta una copia recodificada, redimensionada o recortada.
Además, las copias locales del MP4 disponibles durante esta ejecución no tenían
un contenedor reproducible (`moov atom not found`), por lo que no se regeneró el
manifest ni se volvió a inferir. El manifest real ya versionado permanece ligado
al SHA-256 original `7bfad9a...` y fue consumido sin cambios.

Siguiente prioridad: obtener un dataset externo de handball con licencia y
procedencia verificables, ejecutar este gate, separar un validation set externo
y recién entonces entrenar/admitir un checkpoint single-class para compararlo
sobre los 113 cuadros held-out.
