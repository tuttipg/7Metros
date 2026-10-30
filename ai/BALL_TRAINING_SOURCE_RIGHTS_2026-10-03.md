# Filtro de derechos para fuentes de entrenamiento — 03/10/2026

## Decisión

No descargar ni entrenar todavía con EIGD. Es una fuente oficial de video de
handball, pero el medio se publica bajo `CC-BY-NC-SA-4.0`, incompatible con el
modo conservador `product`. Además, no se localizó un artefacto descargable y
versionado que cubra las anotaciones de pelota y permita verificar su licencia,
bytes y cajas. Esto es un rechazo de procedencia, no una conclusión sobre la
calidad visual del dataset.

Dos candidatos de Roboflow ([177 imágenes](https://universe.roboflow.com/acvpr-handball/ball-detection-copy-june-6)
y [292 imágenes](https://universe.roboflow.com/acvpr-handball/ball-detection-copy))
declaran `CC-BY-4.0`, pero sus páginas publican cero versiones de dataset y los
ejemplos de acceso requieren `API_KEY`. No se usaron credenciales ni se enviaron
frames del partido.

## Mejora ejecutable

`screen_ball_training_sources.py` aplica un contrato fail-closed antes de
descargar o entrenar:

1. exige URLs HTTPS y derechos separados para `original_media` y `annotations`;
2. valida atribución, fecha de consulta y obligaciones de la licencia;
3. rechaza licencias no revisadas;
4. en modo `product`, rechaza `CC-BY-NC-4.0` y `CC-BY-NC-SA-4.0`;
5. conserva explícitamente `dataset_admission_status=NOT_EVALUATED` y
   `model_accuracy_status=NOT_EVALUATED`.

El estado aprobado se llama
`SOURCE_RIGHTS_SCREEN_PASSED_NOT_DATASET_ADMISSION`: nunca reemplaza el hash,
la validación estructural/perceptual del dataset ni una evaluación held-out.

## Validación y evidencia

- 5 pruebas nuevas: CC BY completo, rechazo NC para producto, aceptación NC sólo
  para screening de investigación, falta de derechos de anotaciones y licencia
  desconocida/obligaciones incompletas;
- candidato EIGD en modo producto: **rechazado**, 1 fuente, cobertura sólo de
  `original_media`, 2 causas independientes;
- no hubo descarga, entrenamiento, inferencia ni replay.

Reproducir:

```bash
PYTHONPATH=ai python -m unittest ai.tests.test_ball_training_sources -v
PYTHONPATH=ai python ai/screen_ball_training_sources.py \
  --manifest ai/evidence/ball/eigd_training_sources_candidate_2026-10-03.json \
  --intended-use product
```

Evidencia:
`ai/evidence/ball/eigd_training_sources_candidate_2026-10-03.json` y
`ai/evidence/ball/eigd_training_source_screen_product_2026-10-03.json`.

## Límite y siguiente prioridad

Este filtro codifica una política técnica conservadora; no sustituye asesoría
legal. El próximo paso es localizar un archivo de anotaciones de pelota con URL,
licencia y hash verificables, o una fuente alternativa compatible. Sólo después
corresponde descargarla, ejecutar el validador contra los 113 frames held-out y
entrenar un checkpoint single-class para el benchmark real.
