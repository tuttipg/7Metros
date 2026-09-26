# Recuperación y experimento de movimiento

El entorno de esta ejecución volvió a a9b0d6e; los objetos Git 35f4eb8 y
5848493 y el entorno Python no estaban disponibles. Se recuperó el núcleo
de equipos temporales, candidatos de rol y CLI desde los parches registrados
en la conversación. Se recuperó Evidencia_equipos_roles.zip para comparación.

La reejecución con alpha=1 produjo tracks.jsonl idéntico byte por byte al
JSONL guardado de la versión 5848493: 3600 frames, 34925 observaciones, 400 IDs.
Esto verifica equivalencia de salida en este fixture, no recuperación exacta
del árbol de código anterior ni de sus hashes de commit. Los tests recuperados
se consolidaron; no son exactamente la misma colección anterior.

## Experimento

Nuevo parámetro velocity_alpha: media exponencial de velocidad, salvo la primera
estimación. Default 1 conserva el comportamiento. Alpha .25 es opt-in.

| Medida | Recuperada alpha=1 | Experimento alpha=.25 |
|---|---:|---:|
| Observaciones |34925|34925|
| IDs |400|391|
| Span medio s |3.055|3.135|
| Mediana observaciones por ID |17.5|17|
| IDs de una observación |60|57|

No se promueve el experimento como mejora de identidad: menos IDs pueden ocultar
fusiones incorrectas y la mediana empeora ligeramente. 143.26 FPS de replay
sin inferencia neuronal, no rendimiento extremo a extremo.

## Auditoría visual limitada

Se revisaron dos jugadores (blanco en primer plano y azul a la izquierda) en
frames 0,30,60,90. Ocho puntos de torso anotados por el asistente desde imágenes
del clip fuente; sin revisión humana independiente. En ambas versiones:
8 puntos dentro de una única caja, 0 ambiguos, 0 perdidos, secuencias IDs
[1,1,1,1] y [3,3,3,3]. Cero cambios OBSERVADOS ENTRE MUESTRAS.
No excluye cambios entre muestras ni mide oclusiones difíciles. No es HOTA,
IDF1 ni precisión general. Los puntos no son cajas de ground truth.

46 tests aprobados sin skips. Test sintético verifica ruido de centroides
seguido de dos frames perdidos; auditoría rechaza solapamientos ambiguos.

```bash
# desde ai, OpenCV 5.0.0.93, NumPy 2.5.3, Python 3.12
python run_fixture.py --video /ruta/fixture120.mp4 --out /ruta/smooth --cache /ruta/detections.jsonl --fixture-kits --temporal-teams --velocity-alpha .25
python audit_points.py --reference fixtures/ferro_lujan_sparse_points.json /ruta/recovered-kits/tracks.jsonl /ruta/smooth/tracks.jsonl
python -m unittest discover -s tests
```

Video SHA256: 7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d.
Misma caché YOLO11n, sin entrenamiento. Los colores siguen siendo heurísticas
específicas, árbitros/arqueros candidatos y el banco sigue causando errores.
Exportador directo H264 de la iteración anterior no recuperado en este commit;
el runner genera MP4V. No se entrega otro video casi idéntico como gran avance.

Siguiente: ampliar referencia a cruces reales, medir errores de asociación y
comparar un asociador global. Es necesario preservar commits en GitHub: una
revisión automática previa bloqueó publicación sin autorización explícita.
Este commit es local y no modifica Supabase ni la página publicada.
