# Primera ejecución real: Ferro–N. S. de Luján

MP4 aportado por Tomás: 20260926-1444-24.0816290.mp4.
Duración fuente 374,7333 s, 936×524, 30 FPS. El marcador visible muestra FCO/NSL.
Ventana utilizada: segundos 30–150 del archivo, 120 s / 3600 frames.
Sin entrenamiento. YOLO11n genérico COCO, clase person, confianza 0,25,
CPU, imagen de inferencia predeterminada del adaptador (640), 2 threads Torch.

## Comparación

Baseline local: PR #43 + correcciones 16f2edf, sin clasificación ni filtro.
Iteración: mismo detector/cache, NMS adicional IoU 0,55, filtro de cancha azul,
color de torso y corrección de brillo para camiseta blanca bajo dominante azul.
Los umbrales se ajustaron mirando este clip: no es un conjunto de evaluación independiente.

| Medida | Baseline | Iteración |
|---|---:|---:|
| Frames | 3600 | 3600 |
| Observaciones de personas retenidas | 40416 | 34925 |
| IDs generados | 875 | 661 |
| Span medio de ID | 1,670 s | 1,906 s |
| Mediana de observaciones/ID | 11 | 9 |
| IDs de un solo frame | 124 | 91 |
| Observaciones con equipo por color | 0 | 28959 (82,92%) |
| team_a / team_b / unknown | 0 / 0 / 40416 | 18423 / 10536 / 5966 |

Menos IDs no demuestra menos intercambios de identidad. La mediana empeoró;
la reducción de tracks también puede incluir personas correctamente detectadas
pero rechazadas por el filtro. No se afirma precisión, recall, mAP, IDF1 ni HOTA.
IDs son segmentos de seguimiento, no jugadores reales distintos.

## Rendimiento: no comparar cifras incompatibles

Baseline completo: 145,265 s, 24,78 FPS (detección + tracking + escritura).
Iteración por replay: 23,014 s, 156,42 FPS (sin inferencia neuronal).
Estos 156,42 FPS NO son velocidad end-to-end. La caché permite repetir pruebas
sin pagar otra inferencia y mantener exactamente las mismas detecciones.

## Inspección visual

Revisados frames 0, 900, 1800 del recorte (30, 60, 90 s del original), además
del frame 1800 del MP4 final. En el primero, dos cajas en el blanco #9 se
reducen a una. A los 60 s del recorte se elimina una persona fuera del lateral.
Persisten cajas que abarcan dos jugadores en cruces, una persona del banco
parcial en el borde inferior, jugadores omitidos y fragmentación fuerte.
Los números sobre las cajas son confianza del detector, no confianza del equipo.
La figura comparativa usa números locales por fotograma; el MP4/JSONL sí usa
los IDs del tracker persistente.

team_a=apariencia clara, team_b=apariencia violeta; sin mapeo automático al club.
Arqueros/árbitros no se reconocen como roles: siguen saliendo como player por
el adaptador genérico y a menudo sin equipo. El filtro es específico del suelo
azul y puede fallar con paneos, repeticiones, logos, bordes y otras canchas.
No hay pelota, posesión, goles ni coordenadas métricas implementadas aquí.

## Reproducción

```sh
ffmpeg -ss 30 -i original.mp4 -t 120 -an -c:v libx264 -preset fast -crf 20 fixture120.mp4
cd ai
python run_fixture.py --video fixture120.mp4 --out results/baseline --cache results/detections.jsonl
python run_fixture.py --video fixture120.mp4 --out results/refined --cache results/detections.jsonl --refine
python -m unittest discover -s tests -v
```

Crear la carpeta results antes de ejecutar si se ubica fuera de --out.
33/33 tests ejecutados con dependencias de visión instaladas.
Hash fuente: 84a94f6e5526d94afc67dc8ee99cc9b390265482d6f0250f2d8a12080e437ed2.
Hash recorte: 7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d.
Hash pesos: 0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1.
Versiones: Python 3.12, torch 2.14.0+cpu, torchvision 0.29.0+cpu,
ultralytics 8.4.163, OpenCV 5.0.0.93, NumPy 2.5.2.

## Prioridad siguiente

Crear ground truth breve para cruces y roles, comparar un tracker con asociación
global/ReID y medir identidad. Mantener estas heurísticas opt-in hasta verificar
su generalización. Sin escrituras en Supabase ni publicación de video ajeno.
