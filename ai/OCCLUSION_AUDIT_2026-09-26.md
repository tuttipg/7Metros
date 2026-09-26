# Oclusión real: memoria de seguimiento

Se revisó el contacto atacante/defensor a segundos 4–6.5 del clip, con 12
puntos de torso (dos personas, seis instantes separados 0.5 s). Referencia
anotada visualmente por el asistente; no verificada por otra persona, no cajas
completas ni métricas estándar MOT. Fuente: mismo clip SHA256
7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d.

## Hallazgos

La detección combina ambas personas durante parte del contacto. El evaluador
anterior aceptaba como dos matches una caja con dos puntos: corregido para
marcar `shared_box`, excluir ambos de la secuencia de IDs e informar el problema.
Esto cambia la interpretación de la auditoría, no mejora las detecciones.

| Configuración | Secuencia azul en muestras no ambiguas | Secuencia blanca | Cambios muestreados |
|---|---|---|---:|
| Actual: alpha=1, memoria8 |3,3,25,25|18,18,18,18,18|1|
| Suavizado anterior: alpha=.25, memoria8 |3,3,24,24|17,17,18,23,23|3|
| Experimento: alpha=1, memoria30 |3,3,3,3|17,17,17,17,17|0|

En los tres casos: 9 puntos asignables, 1 ambiguo entre cajas y 2 en caja
compartida. No se cuentan como aciertos de identidad. No se dibujan personas
inventadas durante la oclusión. La variante mantiene más tiempo el estado
interno y reutiliza el ID al reaparecer una detección compatible.

El suavizado anterior reduce IDs globales pero empeora este cruce: no se
recomienda como mejora comprobada. `--max-missed 30` sí recupera el defensor
en esta secuencia. A 30 FPS equivale a 1 segundo, frente a 0.267 segundos.
El parámetro está en frames y debe adecuarse al FPS. Default sigue siendo8.

## Clip completo: mismo detector/cache/filtros

| Medida | memoria8 | memoria30 |
|---|---:|---:|
| Frames |3600|3600|
| Observaciones |34925|34925|
| IDs |400|273|
| Span medio (s) |3.055|4.753|
| Mediana observaciones/ID |17.5|44|
| IDs de una observación |60|29|

La reducción global de IDs no prueba exactitud: mantener tracks viejos puede
asociar otra persona por error. Sólo se verificó la mejora en el contacto
seleccionado. HOTA/IDF1, ID switches completos, mAP y precisión siguen sin medir.
La referencia fácil inicial (8 puntos) también se ejecutó y conserva sus IDs.
No hay entrenamiento ni nueva inferencia neuronal; la prueba reproduce la caché.

49 tests aprobados. Incluyen caja compartida, memoria de20 frames y expiración
después de31. Se inspeccionó la comparación renderizada en t=6s: defensor25
antes y3 después. Persisten errores de rol por iluminación, incluyendo arquero
rosa candidato a árbitro en esa imagen; no se atribuye ninguna mejora de roles.

## Reproducir desde ai/

```bash
python run_fixture.py --video /ruta/fixture120.mp4 --out /ruta/memory30 --cache /ruta/detections.jsonl --fixture-kits --temporal-teams --max-missed 30
python audit_points.py --reference fixtures/ferro_lujan_crossing_points.json /ruta/recovered-kits/tracks.jsonl /ruta/memory30/tracks.jsonl
python compare_video.py --video /ruta/fixture120.mp4 --before /ruta/recovered-kits/tracks.jsonl --after /ruta/memory30/tracks.jsonl --output /ruta/comparacion.mp4
python -m unittest discover -s tests
```

Comparación: clip fuente segundos3–8, 150 frames, reproducción a mitad de velocidad
(10 s), H264 CRF18 directo desde el clip fuente, 1872x564, sin audio. Etiquetas
izquierda/derecha, tiempo fuente. Los IDs entre versiones no son comparables
numéricamente salvo para seguir su continuidad dentro de cada versión.

Siguiente: ampliar auditoría a más cruces y salidas/reentradas; asociación
global y apariencia antes de convertir memoria30 en valor predeterminado.
