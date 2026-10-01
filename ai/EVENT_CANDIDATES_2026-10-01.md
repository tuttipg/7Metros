# Candidatos conservadores de evento — Ferro–Luján — 01/10/2026

## Objetivo

La primera capa de posesión produce `POS?`, no posesión confirmada. Para avanzar hacia eventos sin convertir ruido frame-a-frame en estadísticas, se agregó una etapa todavía más conservadora basada únicamente en **runs estables** de esos candidatos.

`stable_candidate_runs()` conserva sólo candidatos del mismo jugador/equipo presentes al menos 2 frames consecutivos. `detect_control_change_candidates()` marca una transición sólo cuando dos runs estables de jugadores distintos están separados por como máximo 4 frames.

La salida distingue:
- `same_team_control_change_candidate`;
- `opponent_control_change_candidate`.

Deliberadamente **no** se llaman `pass`, `steal`, `turnover` ni `recovery`: todavía no existe ground truth específico de eventos y la geometría observada por sí sola no demuestra la semántica del handball.

## Ejecución real — GT1

Input: los 105 frames de candidatos de posesión del fixture Ferro–N. S. de Luján.

Runs estables (mínimo 2 frames):
- `#16 Ferro`, frames 126–128 (3);
- `#1 Ferro`, 148–149 (2);
- `#5 Luján`, 151–155 (5);
- `#7 Luján`, 194–197 (4).

Con gap máximo 4, aparece **1 solo candidato de cambio de control**:
- frame 151;
- `#1 Ferro → #5 Luján`;
- tipo `opponent_control_change_candidate`;
- gap intermedio: 1 frame;
- evidencia fuente: 2 frames; evidencia destino: 5 frames.

La secuencia fue inspeccionada visualmente como sanity check y corresponde a una disputa/transición con pelota libre compatible con el rótulo genérico `CONTROL CHANGE?`. Esto no valida que haya sido robo, pérdida o recuperación oficial.

Artefactos locales:
- MP4 demo SHA256 `bc61b7cd998fc7a2c9a9c6094511b0073266ba141fba87adef694fb9085415cd`;
- JSON SHA256 `7b2da8c264063acd50d9580046b300ee8c0da04f884ea8d9659ecd6e8454219a`.

## Tests

Suite local: **210/210 OK**.

## Decisión

**KEEP como capa experimental de eventos candidatos.**

No genera estadísticas oficiales. El próximo cuello funcional es separar mejor pelota libre vs pelota controlada y construir una señal de lanzamiento que use trayectoria/cancha, no sólo proximidad a un jugador.
