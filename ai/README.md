# 7Metros AI — baseline v1

Primer baseline ejecutable de visión por computadora para 7Metros.

## Estado real

Este módulo **no afirma que exista un modelo entrenado específicamente para handball**. La primera etapa usa un detector genérico de personas de Ultralytics como adaptador opcional y un tracker determinista propio como baseline. Su objetivo es fijar un flujo reproducible y un contrato de datos estable antes de incorporar datasets, modelos y trackers más fuertes.

## Qué hace hoy

- Lee un video local con OpenCV.
- Detecta personas mediante un modelo Ultralytics configurable.
- Asigna IDs persistentes con un tracker determinista que usa centroide y predicción de velocidad constante.
- Puede clasificar equipos con un baseline conservador de color de camiseta usando referencias RGB conocidas; los casos ambiguos permanecen como `unknown` en vez de forzar una etiqueta.
- Escribe un JSONL por frame con `track_id`, bounding box, confianza, centro, velocidad estimada y equipo opcional.
- Puede producir un MP4 anotado con bounding boxes, confianza e IDs persistentes para inspección visual cuadro a cuadro.
- Devuelve métricas del procesamiento y salud del tracking: observaciones por track, span medio, tracks de un solo frame, tasa de IDs nuevos cada 100 frames y cobertura de etiquetas de equipo.
- Mantiene tests del tracker, métricas, visualización, clasificación de color y contrato de salida sin requerir GPU.

## Instalación

```bash
cd ai
python -m venv .venv
# activar el entorno según el sistema operativo
pip install -e ".[vision]"
```

## Ejecución

Salida de datos:

```bash
7metros-ai --video partido.mp4 --output-jsonl artifacts/tracks.jsonl
```

Salida de datos + video anotado:

```bash
7metros-ai \
  --video partido.mp4 \
  --output-jsonl artifacts/tracks.jsonl \
  --output-video artifacts/annotated.mp4
```

Para una prueba corta:

```bash
7metros-ai --video partido.mp4 --output-jsonl artifacts/tracks.jsonl --output-video artifacts/annotated.mp4 --max-frames 300
```

La salida de consola incluye `tracking_metrics`. Estas métricas sirven para comparar configuraciones o trackers sobre exactamente el mismo video, pero **no equivalen a métricas de identidad como IDF1/HOTA** porque todavía no existe ground truth anotado verificado.

## Clasificación de equipos por color

`JerseyColorTeamClassifier` recibe referencias RGB por equipo, por ejemplo `{"home": (200, 30, 30), "away": (30, 40, 200)}`. El clasificador toma una región central del torso, calcula un color representativo robusto y compara cromaticidad para reducir sensibilidad a cambios de iluminación. Si la muestra queda demasiado lejos de las referencias o la diferencia entre los dos mejores candidatos es pequeña, devuelve `None`.

Este baseline no sustituye un clasificador aprendido y todavía necesita calibrar referencias para cada partido. Su objetivo inmediato es aportar una señal reproducible y segura al tracker, que ya evita asociaciones incompatibles cuando ambos lados conocen el equipo.

## Contrato `7metros-ai.v1`

Cada línea del JSONL representa un frame y contiene: versión de esquema, índice y timestamp del frame, tamaño de imagen y objetos con `track_id`, tipo, confianza, bounding box, centro, velocidad estimada y equipo opcional.

El contrato puede ampliarse sin romper los campos base con `team`, `player_id`, `court_xy`, `possession`, eventos y pelota.

## Tests

```bash
cd ai
python -m unittest discover -s tests -v
```

Los tests actuales verifican persistencia de ID, creación de ID nuevo ante salto espacial, recuperación tras un frame perdido, continuidad de ID con movimiento rápido usando predicción de velocidad, serialización estable del contrato `7metros-ai.v1`, cálculo determinista de métricas de salud del tracking, formato estable de las etiquetas del video anotado y reglas conservadoras de clasificación de equipos por color.

Estos tests también forman parte de `.github/workflows/validate.yml`, por lo que el PR falla si se rompe el baseline de tracking o su contrato.

## Limitaciones conocidas

- El detector genérico de personas no está ajustado a handball.
- La predicción de velocidad mejora el baseline, pero no reemplaza ByteTrack/BoT-SORT ni resuelve por sí sola oclusiones o cruces complejos.
- El clasificador de equipos por color requiere referencias del partido y puede quedar ambiguo con camisetas similares, sombras, chalecos o arqueros con indumentaria distinta.
- Las métricas actuales miden salud/churn del tracker y cobertura de equipo; sin anotación humana no permiten afirmar precisión de identidad o clasificación.
- Aún no hay detección de pelota, clasificación específica de arqueros ni eventos.
- La precisión real sobre partidos FEMEBAL no se puede afirmar sin un video de prueba accesible al runtime.
- Los pesos de Ultralytics pueden requerir descarga la primera vez.

## Próximos hitos

1. incorporar un video de prueba descargable de forma reproducible;
2. medir detecciones, estabilidad de IDs y cobertura de equipo sobre handball real y revisar el MP4 anotado;
3. sustituir/comparar el tracker baseline con ByteTrack/BoT-SORT;
4. añadir detector de pelota separado;
5. añadir calibración automática de colores de equipo y coordenadas de cancha;
6. agregar eventos de posesión, lanzamiento y gol sobre señales verificables.
