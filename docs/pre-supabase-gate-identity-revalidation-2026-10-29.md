# Auditoría SAFE: revalidación completa de identidad en el gate pre-Supabase — 2026-10-29

## Hallazgo

La función `validatePreSupabaseCandidate` revalidaba la fecha, los nombres de los equipos y el marcador contra `expected_match_evidence`, pero no comparaba la hora, la categoría ni la división. El parser DRY RUN sí contrastaba esos campos antes, pero el gate se define como una frontera de confianza independiente y no debe depender exclusivamente de la validación previa.

Una evidencia estructurada modificada después del parser podía conservar `expected_match_checked: true` y valores incorrectos de hora/categoría/división sin que el gate comprobara esos tres campos. Esto era una brecha de defensa en profundidad, no evidencia de una vulnerabilidad explotada ni de acceso a un endpoint de FEMEBAL.

## Corrección

- El gate exige ahora hora, categoría y división tanto en la planilla parseada como en la evidencia esperada.
- Valida hora en formato `HH:MM` o `HH:MM:SS`, con rangos de reloj válidos.
- Compara hora, categoría y división, además de fecha, local, visitante y marcador.
- Mantiene la normalización de tildes/mayúsculas para categorías, divisiones y nombres.
- Conserva `write_enabled=false`, `production_write_allowed=false` y el resultado preview-only.

## Regresiones añadidas

El smoke del gate ahora rechaza evidencia con hora, categoría o división alteradas u omitidas, y también rechaza esos campos ausentes/malformados en la planilla parseada. El caso positivo conserva el partido de control Argentinos Juniors 20–27 Ferro, 21/03/2026, 20:15, Mayores, LHC Hipotecario Seguros.

## Alcance y límites

- El cambio endurece la validación local; no descubre ni descarga una planilla nueva.
- La identidad de control del test es sintética y no constituye evidencia de procedencia pública del PDF.
- No se ejecutaron llamadas de red a FEMEBAL/TournamentTracker.
- No se usaron credenciales, cookies, tokens ni encabezados `Authorization`.
- No se escribió en Supabase ni se modificó producción.
- La validación de CI del commit final debe comprobarse después de que GitHub Actions termine.
