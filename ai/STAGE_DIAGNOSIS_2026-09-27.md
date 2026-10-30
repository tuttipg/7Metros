# Dónde se pierden las observaciones

Se ejecutó diagnose_stages.py sobre la caché de detecciones y el JSONL de
memoria30, verificando video SHA256/modelo/confianza y correspondencia de cada
caja/confianza/clase con la salida.3600 frames, sin nueva inferencia neuronal.

| Etapa | Observaciones |
|---|---:|
| Detector COCO person, confianza mínima0.25 |40416|
| Tras regla de duplicados IoU>.55 |38679|
| Salida final cancha + tracking |34925|
| Eliminadas por regla de duplicados |1737|
| Resto eliminado en etapa cancha |3754|

La etapa duplicados se reconstruye antes de cancha; si no había evidencia de
cancha, el original cortaba antes de duplicados. El desglose es operacional,
no etiquetado de falsos negativos. Las3754 combinan fuera del contorno y ausencia
de evidencia de cancha; no se reconstruyó la máscara. No todas las exclusiones
son errores. Coincidir cajas no valida identidad.

## Dos tipos de pérdida comprobados

1. Frames150 y1105, correspondientes a los dos cruces revisados: el detector
ya entrega una caja compartida por dos puntos de personas distintas. La
misma situación aparece después de duplicados y en salida. El filtro no
origina esa fusión; tampoco la resuelve el tracker.
2.323 frames sin salida final, todos con al menos una detección original.
Cuatro muestras (420,510,1350,1980; segundos14,17,45,66) revisadas visualmente
son primeros planos de jugadores, con poca/sin cancha. No afirmar que todos
los323 frames son primeros planos ni que perderlos sea incorrecto. Representan
10.77s acumulados de exclusión, no un intervalo continuo.

En este tracker, toda detección que supera el filtro recibe un ID observado:
la asociación puede equivocarse/cambiar ID pero no suprime detecciones.
Por lo tanto hay que separar falta de caja, exclusión por cancha y cambio de
identidad. El diagnóstico no infiere automáticamente la identidad de ausentes.

## Entregables y límites

Script reusable en Python puro, salida por frame y etapas, detección de caja
compartida por referencia y validación de procedencia. Compatible sólo con
este perfil de filtro registrado y umbral de duplicados0.55. Redondeo de
JSONL respetado. Rechaza salidas ajenas a la caché y longitudes incompatibles.
No procesa videos nuevos ni restaura el entorno de inferencia nativa.

```bash
# desde ai/
python diagnose_stages.py --cache /ruta/detections.jsonl --tracks /ruta/memory30/tracks.jsonl --reference fixtures/ferro_lujan_crossing_points.json --reference fixtures/ferro_lujan_second_contact.json > diagnostico.json
python -m unittest discover -s tests
```

Próximo trabajo: separar planos de cancha/primeros planos y cortes, y comparar
detección en cruces con imágenes más grandes o nuevos pesos. No aumentar la
memoria como solución a cajas fusionadas. Sin nuevas métricas de precisión.
