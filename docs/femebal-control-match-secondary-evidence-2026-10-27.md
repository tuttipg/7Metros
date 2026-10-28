# Evidencia secundaria del partido de control FEMEBAL — 2026-10-27

## Objetivo

Registrar evidencia pública secundaria que permita validar la identidad del partido de control usado por el discovery SAFE de 7Metros, sin confundirla con evidencia de una planilla FEMEBAL.

## Partido de control

- Competición: FeMeBal LHC Hipotecario Seguros / Liga de Honor Oro.
- Fecha local establecida por la programación oficial: 21/03/2026.
- Local: Argentinos Juniors.
- Visitante: Ferro Carril Oeste.
- Marcador: 20–27.

## Evidencia pública secundaria

### 365Scores

La búsqueda pública de 365Scores devuelve el enfrentamiento histórico y lista explícitamente:

`Argentinos Juniors Liga de Honor Oro 20 - 27 Ferro Carril Oeste 21/03/2026`

Fuente observada:

https://www.365scores.com/fi/handball/match/undefined-8194/undefined-81167-81170-8194

Esta fuente sirve para corroborar identidad, competición, clubes, fecha y marcador. **No demuestra la existencia ni la URL de una planilla FEMEBAL** y no debe convertirse en una fuente de importación.

### Sofascore

Sofascore expone el encuentro como:

`Argentinos Juniors 20 - 27 Ferro Carril Oeste`

para FeMeBal LHC Hipotecario Seguros:

https://www.sofascore.com/handball/match/argentinos-juniors-ferro-carril-oeste/iRocsyZRj

**La marca temporal publicada entra en conflicto con la programación oficial.** La página indica 20/03/2026 a las 23:15 UTC. Convertida literalmente a Argentina (UTC−03:00), equivale a **20/03/2026 a las 20:15 local**, no al 21/03/2026 a las 20:15 local que figura en la programación oficial de FEMEBAL. No se debe corregir ni reinterpretar silenciosamente esa marca temporal ni usarla como clave exacta de unión. El marcador y los equipos sirven como corroboración secundaria; la fecha/hora de Sofascore debe conservarse como dato discrepante.

La programación oficial de FEMEBAL para el sábado 21/03/2026 confirma en AAAJ Globo el partido masculino Mayores / LHC Hipotecario Seguros entre Argentinos Juniors y Ferro Carril Oeste a las 20:15:

https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf

Esta programación acredita el fixture y su hora local, no el resultado final ni las estadísticas individuales.

## Valor para discovery SAFE

Una futura evidencia pública de TournamentTracker/planilla debe coincidir como mínimo en:

1. Argentinos Juniors.
2. Ferro Carril Oeste.
3. Liga de Honor / LHC masculino.
4. Fecha local 21/03/2026 y hora 20:15, según programación oficial.
5. Marcador final 20–27, cuando una fuente de resultado lo proporcione.

Las fuentes secundarias no se usan para enumerar tokens, descubrir endpoints internos, descargar PDFs ni habilitar probes automáticos.

## Estado

- Fixture oficial: **confirmado** por la programación FEMEBAL.
- Identidad y marcador 20–27: **corroborados por fuentes secundarias**.
- Marca temporal Sofascore: **discrepante en un día** respecto de la programación local; conservar ambas representaciones sin normalización silenciosa.
- Enlace público FEMEBAL/TournamentTracker al partido concreto: **pendiente**.
- Planilla pública FEMEBAL trazable al partido: **pendiente**.
- Escrituras Supabase/producción: **no realizadas**.
- Credenciales, cookies, tokens y `Authorization`: **no utilizados**.
