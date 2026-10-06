# Huella de píxeles del holdout de pelota — 03/10/2026

## Objetivo

El futuro detector específico de handball debe entrenarse con datos externos y
mantener los cuadros revisados de Ferro–N. S. de Luján exclusivamente para
evaluación. La declaración de exclusión incorporada al gate de modelos ahora se
complementa con evidencia técnica verificable.

## Cambio

`build_ball_holdout_manifest.py` valida primero que el SHA-256 del video coincida
con la caché v2 y obtiene de ella la cobertura exacta. Luego decodifica el video
secuencialmente y hashea, para cada cuadro reservado:

- dimensiones;
- dtype `uint8`;
- layout `BGR`;
- bytes contiguos de píxeles.

El manifest falla si la caché usa otro video, contiene frames repetidos, el
video termina antes de un frame pedido o hay dos cuadros pixel-idénticos dentro
del holdout. El output existente tampoco se sobreescribe.

## Validación real

- video `fixture120.mp4` SHA-256:
  `7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d`;
- caché v2 SHA-256:
  `fc0494dcae2e6355920b4cef1b96c735fd1f62e78412b104cbd8445b5e23f8d5`;
- cuadros reales cubiertos: **113**;
- huellas de píxeles únicas: **113/113**;
- fingerprint agregado:
  `09d267d8594d38e40e67e4d6308fca4049d1ff3a978e1c0c76714000dd3913a0`;
- OpenCV: `4.11.0`;
- dos ejecuciones independientes produjeron archivos byte-idénticos, SHA-256
  `d9d1d302ab82d652626dfcd860a57db85651d3f29e083618dba8c0f46434885a`.

Cinco pruebas nuevas cubren cambio de píxel, geometría inválida, binding al hash
de video, frames duplicados/desordenados, liberación del video, final prematuro
y construcción determinista.

Evidencia:
`ai/evidence/ball/ball_holdout_pixel_manifest_2026-10-03.json`.

## Interpretación y límite

Esto no ejecuta inferencia ni replay y no mide accuracy; por eso el manifest usa
`HELDOUT_PIXEL_FINGERPRINTS_NOT_MODEL_ACCURACY`. Sirve para detectar contaminación
por copias pixel-idénticas. Una imagen recodificada, redimensionada o recortada
puede tener otros bytes aunque provenga del mismo frame; esa detección requerirá
una segunda capa perceptual antes de entrenar.

Siguiente prioridad: conectar esta lista a un validador de dataset YOLO y luego
entrenar un primer checkpoint específico sin tocar los 113 cuadros held-out.
