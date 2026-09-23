# Evidencia pública FEMEBAL — programación 21/03/2026

Fecha de revisión: 2026-09-23

## Objetivo

Registrar una fuente pública oficial, independiente de la planilla de partido, para validar metadatos esperados del partido control usado por el pipeline SAFE/DRY RUN.

Esta evidencia **no autoriza probes adicionales**, no contiene credenciales y no habilita escrituras.

## Fuente oficial

- Página oficial FEMEBAL de Programación Fecha 1 — Torneo Metropolitano Apertura 2026: `https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/`
- PDF oficial enlazado desde esa página para el sábado 21/03/2026: `https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf`
- Publicación de la página: 20/03/2026.

La relación página → PDF es importante: evita tratar una URL PDF inferida como evidencia suficiente por sí sola.

## Partido control observado

En la programación oficial del 21/03/2026 aparece:

- categoría: `Mayores`
- división: `LHC Hipotecario Seguros`
- hora: `20:15`
- rama: `M`
- local: `Argentinos Juniors`
- visitante: `Ferro Carril Oeste`
- sede/bloque: `AAAJ Globo (Argentinos Juniors)`

Esto coincide con la identidad base del partido control ya usado por las regresiones del proyecto: Argentinos Juniors vs. Ferro Carril Oeste, 21/03/2026.

## Límite de la evidencia

La programación **no demuestra el marcador final 20–27 ni estadísticas de jugadores**. Esos datos deben seguir proviniendo de una planilla/resultado oficial validado por separado.

Por lo tanto, las afirmaciones deben mantenerse separadas:

- programación oficial → fecha, equipos, categoría/división, rama, hora y sede;
- planilla/resultado oficial → marcador y estadísticas;
- parser/gates SAFE → consistencia interna y revalidaciones, nunca creación de hechos faltantes.

No se debe promover una programación a `match_result_evidence` ni completar un marcador a partir de conocimiento previo.

## Uso SAFE recomendado

Esta fuente puede utilizarse como `expected_match` previo al parsing de una planilla, siempre que el consumidor conserve la procedencia y compare de forma fail-closed los campos presentes. Una discrepancia entre programación y planilla debe producir revisión, no corrección automática.

La fuente no cambia las restricciones actuales:

- GET público/anónimo únicamente cuando una URL haya superado la política correspondiente;
- sin cookies, tokens, Authorization ni secretos;
- sin TournamentTracker automático;
- sin escrituras Supabase/productivas;
- `write_enabled=false` y `production_write_allowed=false` siguen siendo invariantes.
