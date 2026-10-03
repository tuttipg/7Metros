# Adaptador verificable para detector especializado de pelota — 03/10/2026

## Cambio

El detector y el benchmark ya no suponen obligatoriamente la clase COCO 32.
`--ball-class-id` permite ejecutar un peso especializado de una sola clase
(habitualmente clase 0), mientras 32 sigue siendo el valor por defecto. El ID de
clase forma parte del contrato estricto de caché: una caché de clase 0 no puede
reproducirse como clase 32 ni viceversa. Valores negativos, booleanos, strings o
floats se rechazan sin conversión silenciosa.

Esto elimina un bloqueo de integración, pero no incorpora todavía un detector
especializado ni demuestra su calidad.

## Validación

- 15 pruebas focalizadas cubren selección de clase, clase 0, compatibilidad por
  defecto, round-trip de caché y rechazo de configuración cruzada.
- Replay de la caché existente: omitir el parámetro y pasar explícitamente clase
  32 producen archivos idénticos, SHA-256
  `0b23f59ab45c24f37031801a67c072a48260877d949d91763c545fc07e0c352c`.
- Inferencia neuronal nueva sobre los mismos 113 cuadros, peso y parámetros:
  132 detecciones en ambas corridas y exactamente las mismas decisiones de
  umbral `.05` cuadro por cuadro.
- La inferencia fresca conserva 44/53 matches, 2 falsos positivos evaluables,
  precisión de muestra `0,9565`, recall `0,8302` y los dos controles de
  no-regresión en `true`.

La caché fresca no es byte-idéntica a la histórica: el máximo desvío observado
fue `0,0001221 px` en coordenadas y `9,24e-7` en confianza. Se registra como
deriva numérica del runtime, no se oculta ni se confunde con replay. Conteos,
pertenencia a umbral, presencia temporal y métricas permanecieron iguales.

Evidencia: `ai/evidence/ball/ball_class_id_adapter_validation_2026-10-03.json`.

## Fuentes especializadas localizadas

Se identificaron dos conjuntos CC BY 4.0 preparados para YOLO, pero no un peso
público verificable listo para ejecutar sin credenciales:

- Player and Handball Detection: 1.443 imágenes, formatos de descarga incluido
  YOLO11: https://universe.roboflow.com/dats-workspace/player-and-handball-detection
- handball-ballon: 1.213 imágenes, split publicado 972/121/120 y formato YOLO11:
  https://universe.roboflow.com/thesis-hm6sw/handball-ballon

El repositorio `valentinweyer/handball-computer-vision` documenta un pipeline
RF-DETR, pero su preparación descarga datos mediante `ROBOFLOW_API_KEY` y no
publica en el repositorio los pesos ignorados por Git:
https://github.com/valentinweyer/handball-computer-vision

No se usaron credenciales ni secretos, y no se entrenó sobre el GT de evaluación.

## Límite y siguiente prioridad

La clase 0 sólo quedó verificada como contrato de integración con dobles de
prueba. La métrica real sigue correspondiendo a YOLO11n/COCO clase 32 sobre una
muestra revisada de un partido; no es precisión general ni del partido completo.

Siguiente prioridad: obtener de forma reproducible un checkpoint específico de
pelota de handball (o entrenarlo con datos externos al GT), generar su caché a
confianza `.10` sobre estos mismos cuadros y comparar detector y asociación sin
cambiar la muestra.
