# Admisión fail-closed de modelos especializados de pelota — 03/10/2026

## Motivo

La búsqueda específica de handball encontró modelos alojados y datasets, pero no
un checkpoint descargable, versionado y auditable que pudiera ejecutarse sin
credenciales. HSC Wels publica un modelo sobre 938 imágenes; `handball-match/3`
declara 658; `handball-ballon/10`, 966 y una sola clase. Los tres ejemplos de
inferencia remota requieren `API_KEY`, por lo que no se usaron.

Tampoco se incorporaron pesos referenciados por repositorios si el archivo no
estaba versionado. No se enviaron cuadros del partido a servicios externos.

## Cambio

`admit_ball_model.py` agrega un gate previo a cualquier comparación. Falla
cerrado salvo que:

1. el SHA-256 real coincida con el manifest antes de cargar el checkpoint;
2. exista una URL HTTPS de origen, licencia y al menos una fuente de training;
3. el hash del MP4 held-out figure explícitamente excluido del entrenamiento;
4. el artefacto inspeccionado sea `detect`, de una sola clase, y coincidan ID y
   nombre de la clase pelota.

El resultado aprobado se llama
`ADMITTED_FOR_HELDOUT_EVALUATION_NOT_ACCURACY`: habilita una evaluación, no
constituye una métrica ni una afirmación de calidad. El reporte siempre conserva
hashes, tamaño, clases inspeccionadas y errores. Los `.pt` siguen requiriendo una
fuente confiable porque su deserialización no es un sandbox de seguridad.

## Validación

- 5 pruebas nuevas: admisión válida con doble, rechazo por hash, por solapamiento
  no excluido, por checkpoint multiclase y por deriva del nombre de clase.
- Control real YOLO11n, SHA-256
  `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`:
  hash y documentación pasan; el runtime inspecciona `detect` y 80 clases; el
  gate lo rechaza por no ser single-class especializado.
- La evidencia marca `accuracy_status=NOT_EVALUATED`; no se corrió inferencia y
  no se reutilizó replay para fabricar una métrica.

Evidencia:
`ai/evidence/ball/yolo11n_model_admission_negative_control_2026-10-03.json`.

## Límite y siguiente prioridad

El gate no resuelve aún la falta de un peso específico de handball. Al aparecer
un checkpoint confiable, el siguiente paso es admitirlo, generar una caché v2 a
confianza `.10` sobre exactamente los 113 cuadros y comparar contra el baseline
sin cambiar el GT ni los parámetros posteriores.
