# Guardia perceptual del holdout de pelota — 03/10/2026

## Objetivo

La huella exacta anterior bloquea copias pixel-idénticas de los 113 frames de
evaluación, pero una recompresión JPEG o un resize cambia sus bytes. Esta mejora
agrega una segunda capa fail-closed antes de entrenar, sin convertir similitud
visual en una métrica del detector.

## Implementación

El manifest `sevenmetros.ball-holdout-perceptual/v1` conserva SHA-256 de píxeles
y agrega dos huellas de 64 bits por frame:

- dHash sobre gradientes horizontales de una imagen gris 9×8;
- pHash sobre los coeficientes DCT 8×8 de una imagen gris 32×32.

Un dataset se rechaza únicamente si **ambas** distancias cumplen dHash ≤3 y
pHash ≤2. El manifest fija esos umbrales y su fingerprint; cualquier deriva o
edición de sus filas falla cerrada. El reporte aprobado usa el estado
`STRUCTURALLY_VALID_AND_HOLDOUT_EXCLUDED_EXACT_AND_PERCEPTUAL_NOT_MODEL_ACCURACY`.

## Medición real

- video: SHA-256 `7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d`,
  3.600 frames y 120 s;
- holdout: 113 frames, 113 hashes exactos, 84 dHash únicos y 78 pHash únicos;
- fingerprint de filas: `a006db0a195c75bb93965b46dcb388454d2bdb5fb25ff33b13646b6cf7eb4a3a`;
- SHA-256 del manifest: `bac4192f86a7dacee8e6fd8659678f15c7a3464d9c62cbadd273b749eab96394`;
- dos generaciones independientes: archivos byte-idénticos;
- variantes JPEG (calidades 95/75/50/25) y resize (50%/25%): **678/678**
  quedaron dentro del umbral;
- otros frames del clip comprobados: 3.487; coincidencias perceptuales: 50,
  todas a ≤30 frames de un frame held-out y ninguna a mayor distancia temporal;
- integración CLI: un control de tres imágenes fue admitido con 0 matches; una
  recompresión JPEG calidad 25 del frame 108 fue rechazada end-to-end.

La suite queda en 281/281 con runtime de visión y 281/281 en el entorno mínimo,
con 7 skips visuales opcionales.

Evidencia:
`ai/evidence/ball/ball_holdout_perceptual_validation_2026-10-03.json` y
`ai/evidence/ball/ball_holdout_perceptual_manifest_2026-10-03.json`.

## Límites

No es inferencia, replay ni accuracy. Las coincidencias cercanas dentro del mismo
video se bloquean intencionalmente porque también implican fuga temporal. El
guard no detecta bien crops: sólo 7/113 con recorte de 2% y 0/113 con recortes de
5% o 10%. Tampoco demuestra una tasa de falsos positivos general sobre datasets
externos; ante una coincidencia, el dataset se detiene para revisión.

Siguiente prioridad: ejecutar este gate sobre un dataset externo de handball con
licencia y procedencia verificables y, sólo si pasa, entrenar/admitir un modelo
single-class para compararlo sobre el mismo holdout.
