# 7Metros AI — baseline v1

Primer baseline ejecutable de visión por computadora para 7Metros.

## Estado real

Este módulo **no afirma que exista un modelo entrenado específicamente para handball**. La primera etapa usa un detector genérico de personas de Ultralytics como adaptador opcional y un tracker determinista propio como baseline. Su objetivo es fijar un flujo reproducible y un contrato de datos estable antes de incorporar datasets, modelos y trackers más fuertes.

## Qué hace hoy

- Lee un video local con OpenCV.
- Detecta personas mediante un modelo Ultralytics configurable.
- Asigna IDs persistentes con un tracker determinista que usa centroide y predicción de velocidad constante.
- Escribe un JSONL por frame con `track_id`, bounding box, confianza, centro y velocidad estimada.
- Devuelve métricas del procesamiento y salud del tracking: observaciones por track, span medio, tracks de un solo frame y tasa de IDs nuevos cada 100 frames.
- Mantiene tests del tracker, métricas y contrato de salida sin requerir GPU.

## Instalación

```bash
cd ai
python -m venv .venv
# activar el entorno según el sistema operativo
pip install -e ".[vision]"
```

## Ejecución

```bash
7metros-ai --video partido.mp4 --output-jsonl artifacts/tracks.jsonl
```

Para una prueba corta:

```bash
7metros-ai --video partido.mp4 --output-jsonl artifacts/tracks.jsonl --max-frames 300
```

La salida de consola incluye `tracking_metrics`. Estas métricas sirven para comparar configuraciones o trackers sobre exactamente el mismo video, pero **no equivalen a métricas de identidad como IDF1/HOTA** porque todavía no existe ground truth anotado verificado.

## Contrato `7metros-ai.v1`

Cada línea del JSONL representa un frame y contiene: versión de esquema, índice y timestamp del frame, tamaño de imagen y objetos con `track_id`, tipo, confianza, bounding box, centro, velocidad estimada y equipo opcional.

El contrato puede ampliarse sin romper los campos base con `team`, `player_id`, `court_xy`, `possession`, eventos y pelota.

## Tests

```bash
cd ai
python -m unittest discover -s tests -v
```

Los tests actuales verifican persistencia de ID, creación de ID nuevo ante salto espacial, recuperación tras un frame perdido, continuidad de ID con movimiento rápido usando predicción de velocidad, serialización estable del contrato `7metros-ai.v1` y cálculo determinista de métricas de salud del tracking.

Estos tests también forman parte de `.github/workflows/validate.yml`, por lo que el PR falla si se rompe el baseline de tracking o su contrato.

## Limitaciones conocidas

- El detector genérico de personas no está ajustado a handball.
- La predicción de velocidad mejora el baseline, pero no reemplaza ByteTrack/BoT-SORT ni resuelve por sí sola oclusiones o cruces complejos.
- Las métricas actuales miden salud/churn del tracker; sin anotación humana no permiten afirmar precisión de identidad.
- Aún no hay detección de pelota, arqueros, equipos ni eventos.
- La precisión real sobre partidos FEMEBAL no se puede afirmar sin un video de prueba accesible al runtime.
- Los pesos de Ultralytics pueden requerir descarga la primera vez.

## Próximos hitos

1. incorporar un video de prueba descargable de forma reproducible;
2. medir detecciones y estabilidad de IDs sobre handball real con las métricas actuales;
3. sustituir/comparar el tracker baseline con ByteTrack/BoT-SORT;
4. añadir detector de pelota separado;
5. añadir clasificación de equipos y coordenadas de cancha;
6. producir video anotado además de JSONL;
7. agregar eventos de posesión, lanzamiento y gol sobre señales verificables.
