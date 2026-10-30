# Segundo cruce y asociación global experimental

Se amplió la auditoría a frames1080–1120 (36–37.33s), dos compañeros de Luján
cruzándose. 18 puntos de torso cada5frames, revisados en recortes ampliados sin
IDs del tracker. No revisión humana independiente, no ground truth completo.

Corrección explícita: una primera anotación cada1s seguía al receptor del pase
como si fuera el pasador, indicando falsamente un cambio de ID. La revisión
ampliada muestra que eran personas distintas. Se descartó esa referencia;
la referencia guardada contiene las dos trayectorias corregidas. No es un
fallo del tracker ni un resultado mejorado por código.

## Resultados de la referencia corregida

| Configuración | IDs totales 120s | Cambios muestreados primer cruce | Segundo cruce |
|---|---:|---:|---:|
| Greedy memoria8 |400|1|0|
| Greedy memoria30 |273|0|0|
| Global memoria30 |271|0|0|

Segundo cruce: 16 puntos asignables,2 compartiendo caja; 0 perdidos. No equivale
a 100% de precisión. Se excluyen cajas compartidas del cálculo de continuidad.
IDs de memoria30/global: corredor76, pasador77, estables en las8 muestras
asignables de cada persona. Greedy memoria8:113 y116, también estables.
Primer cruce:9 puntos asignables,1 ambiguo,2 compartidos. Igualdad de resultados
locales NO garantiza igualdad de identidad en el resto del video.

Mismos3600 frames y34925 observaciones. No nueva inferencia ni entrenamiento.
SHA256 clip:7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d.

## Implementación

`--assignment global`: asignación uno-a-uno de costo mínimo con SciPy
linear_sum_assignment y columnas ficticias para tracks no asignados. Se
conservan gates de distancia/clase y costo de equipo. No agrega apariencia,
ReID ni capacidad para separar una detección que cubre dos personas.
Costo no asignado=2*max_distance. Es experimental y puede asociar mal personas.
Default continúa greedy, memoria8, alpha1. No se recomienda global como
mejor precisión: la pequeña reducción de273 a271 IDs no la demuestra.

53 tests pasan, sin skips con SciPy1.18.1. Prueba adversaria sintética comprueba
un caso donde greedy toma una pareja que bloquea otra asociación válida;
global conserva ambas. También se prueban gates de clase y tracks no asignados.
Esto no sustituye validación deportiva. Python3.12, OpenCV5.0.0.93, NumPy2.5.3.

```bash
# desde ai/
pip install -e '.[tracking]'
python run_fixture.py --video /ruta/fixture120.mp4 --cache /ruta/detections.jsonl --out /ruta/global30 --fixture-kits --temporal-teams --max-missed 30 --assignment global
python audit_points.py --reference fixtures/ferro_lujan_second_contact.json /ruta/recovered-kits/tracks.jsonl /ruta/memory30/tracks.jsonl /ruta/global30/tracks.jsonl
python -m unittest discover -s tests
```

Comparación visual: segundos35.5–38.5,90 frames a15 FPS (6s), antes greedy30,
después global30; ambos preservan los IDs de la referencia. Se parametrizaron
los títulos para no confundir experimentos. No publicación en producción.

Próximo: evaluar oclusiones largas y reentradas. Aumentar densidad/revisión
de anotaciones antes de usar referencias como criterio de selección de modelo.
