# Candidatos de posesión observada — Ferro–Luján — 01/10/2026

## Objetivo

Después de obtener continuidad detector-backed de pelota, se agregó una primera capa funcional para relacionar `pelota observada → jugador cercano` sin afirmar todavía posesión real.

La regla es deliberadamente conservadora:
- si no existe observación de pelota, el estado es `ball_unobserved`;
- la posesión no se arrastra temporalmente desde frames anteriores;
- se usa distancia del centro de pelota al borde de la caja de jugador, normalizada por altura;
- sólo hay `candidate` si la distancia normalizada es ≤0.35 y aventaja al segundo candidato por ≥0.08;
- si dos jugadores quedan demasiado cerca, `observed_ambiguous`;
- si ninguno está suficientemente cerca, `observed_unassigned`.

La demo usa explícitamente `POS?`, no `POSSESSION`, porque todavía no existe ground truth humano de posesión.

## Ejecución real

GT1 Ferro–N. S. de Luján, 105 frames (fixture 105–209):
- player tracker: `two_stage`, YOLO11n/person 0.10, imgsz 640, filtro temporal de árbitros;
- pelota: `BallObservationTracker`, imgsz 960, low 0.02 / high 0.10;
- fixture lossless SHA256 `aa82e2c4b159c9231a7ab51910176ab1cad83d7c8892a0d9c47cf260666a88ac`;
- player tracks SHA256 `565e5c8f9a742e123a5fb5db8062180a671cd512d917fd6d386d8a7379725b60`;
- ball observations SHA256 `0916efcc44f7b2fc41a6c8c02805ae5b0d63428a37cc873ae0cd895bb1f96335`.

Estados:
- `ball_unobserved`: 67;
- `observed_unassigned`: 17;
- `observed_ambiguous`: 2;
- `candidate`: **19**.

Candidatos: Luján 11 frames, Ferro 8; 9 runs contiguos. Run más largo: 5 frames (`#5 Luján`, 151–155); segundo: 4 frames (`#7 Luján`, 194–197).

Estos números describen la heurística; no son accuracy de posesión. La inspección visual muestra secuencias plausibles y mantiene dudas explícitas en escenas no separables, pero no sustituye anotación humana.

Artefactos locales:
- MP4 SHA256 `88e4071ef717ba491485ff397bcaa1893ec5b9b91d964316ba6890144e3f457e`;
- JSONL SHA256 `25d8f76bbc4de4036274e8522a21c3d773010a5d34af1334b657c1e66897a0d0`.

## Tests

Suite local: **204/204 OK**.

## Decisión

**KEEP como capa experimental de candidatos de posesión.**

No se usa todavía para estadísticas oficiales ni para contar posesiones. El próximo paso funcional es detectar transiciones observadas entre candidatos (posible pase/cambio de control) y separar pelota libre/tiro, manteniendo toda salida como evento candidato hasta tener ground truth específico.
