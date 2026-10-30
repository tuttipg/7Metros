# Screening de detectores externos de pelota — 02/10/2026

## Objetivo

Con el primer ground truth humano positivo de pelota ya disponible (10 cuadros visibles/localizables en los vuelos 108–112 y 156–160), se compararon dos checkpoints externos especializados en pelota de fútbol antes de invertir tiempo en entrenamiento propio.

El criterio es deliberadamente estricto: no se integra un modelo externo si no mejora o al menos reproduce el control YOLO11n COCO sobre exactamente los mismos cuadros visibles.

## Fuente y control

Video fuente local original: SHA256 `84a94f6e5526d94afc67dc8ee99cc9b390265482d6f0250f2d8a12080e437ed2`.

Los 10 cuadros se extraen del mismo contenido del fixture a partir del MP4 original (offset +900 frames). El GT fue creado sobre la copia x264 histórica `7bfad9a...`; por eso esta corrida es un **screening content-aligned**, no un reemplazo del benchmark canónico ya retenido. Como control, el YOLO11n COCO exacto reproduce 9/10 matches IoU≥0.50 sobre estos frames, consistente con el benchmark x264 canónico 9/10.

### Control: YOLO11n COCO `sports ball`

- peso SHA256: `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`;
- Ultralytics 8.4.163;
- `imgsz=960`, clase COCO 32, screening `conf=0.001`;
- matches IoU≥0.50: **9/10**;
- candidata de máxima confianza coincide con GT: **9/10**;
- IoU medio de la mejor candidata: **0.7123**.

## Modelo externo A — YOLOv9 soccer-ball ONNX

Checkpoint público `acatorcini/yolov9-soccer-ball`, entrenado para pelota pequeña en fútbol amateur.

- ONNX SHA256: `9fd2031e5bced9dff47a48bae8c6809dd56493124ef8924ae28a3ce26a17a441`;
- inferencia OpenCV DNN;
- preprocessing documentado por el modelo: resize directo RGB 1280×1280, normalización 0–1;
- salida single-class `(x,y,w,h,conf)`.

Sobre los 10 cuadros visibles:

- matches IoU≥0.50 usando la mejor caja geométrica disponible: **0/10**;
- candidata de máxima confianza coincide con GT: **0/10**;
- IoU medio de la mejor caja geométrica: **0.4470**;
- las cajas cercanas al GT tienen scores ~`1e-8`–`2e-7`; los máximos de confianza del frame apuntan a otros objetos.

En la ventana ambigua de la primera acción de gol (326–340), los máximos permanecen extremadamente bajos (máximo observado ≈0.00239) y se concentran en estructuras fijas/no verificables; como esa ventana no tiene pelota humanamente localizable, no se convierte en precision/recall.

**DECISIÓN: REJECT.**

## Modelo externo B — YOLO11n fine-tune football-ball

Checkpoint público `martinjolif/yolo-football-ball-detection`, YOLO11n fine-tuneado sobre 1.237 imágenes de pelota de fútbol.

- peso SHA256: `fb37942448e7de08745e8aab148d0794f680a738ddd55e5f17abe9ab2d6313fb`;
- Ultralytics 8.4.163;
- `imgsz=960`, `conf=0.001`, single class `ball`.

Sobre los 10 cuadros visibles:

- matches IoU≥0.50: **0/10**;
- candidata de máxima confianza coincide con GT: **0/10**;
- 8/10 cuadros no producen ninguna detección ni siquiera a 0.001;
- 2/10 producen una única caja, ambas fuera de la pelota.

**DECISIÓN: REJECT.**

## Conclusión

Reusar directamente detectores especializados en fútbol no resuelve este fixture de handball y, en estos 10 positivos humanos, es claramente peor que el YOLO11n COCO stock que ya utilizamos.

No se incorporan pesos externos al repo ni al pipeline. No se modifican defaults.

El siguiente experimento cambia de dominio: usar datasets abiertos **específicos de handball** para un fine-tuning pequeño/aislado de pelota, manteniendo los 10 cuadros de 7Metros exclusivamente como evaluación externa y sin entrenar con ellos en la primera corrida.
