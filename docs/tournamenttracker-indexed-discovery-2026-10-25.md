# TournamentTracker — descubrimiento público indexado (2026-10-25)

## Objetivo

Documentar evidencia pública útil para descubrir partidos/planillas de Fe.Me.Bal. sin ejecutar JavaScript remoto ni habilitar probes automáticos.

## Evidencia oficial del partido control

La programación oficial de Fe.Me.Bal. para el sábado 21 de marzo de 2026 registra en AAAJ Globo (Argentinos Juniors) — Gimnasio:

- Categoría: Mayores
- División: LHC Hipotecario Seguros
- Hora: 20:15
- Rama: M
- Local: Argentinos Juniors
- Visitante: Ferro Carril Oeste

Fuente: `https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf`

Esta fuente establece la identidad del fixture, pero no contiene la planilla individual ni el marcador final.

## Resultado del discovery actual

La búsqueda pública de TournamentTracker demuestra que existen rutas opacas indexables bajo `/tournament-tracker/` que pueden devolver contenido de torneo sin depender del shell SPA. Esto es relevante para el descubrimiento seguro porque la ruta puede observarse como evidencia pública antes de considerarla candidata.

La política SAFE de 7Metros mantiene estas rutas como **review-only**:

- HTTPS y host Fe.Me.Bal. únicamente.
- Un único token opaco con formato restringido.
- Sin query ni fragment.
- Sin credenciales, cookies ni `Authorization`.
- Sin ejecución de JavaScript.
- Sin GET automático: `automaticProbeAllowed=false`.
- La evidencia debe identificar la URL observada y su procedencia.

## Limitación importante

En esta ejecución no se encontró evidencia suficiente para afirmar que una ruta indexada concreta corresponde al torneo Apertura/LHC 2026 ni, específicamente, al partido Argentinos Juniors 20–27 Ferro del 21/03/2026.

Por lo tanto, **no se registra ninguna ruta opaca como planilla del partido control**.

## Próximo criterio de validación

Una ruta candidata sólo podrá considerarse útil cuando su contenido público pueda vincularse de forma reproducible con al menos estos identificadores del partido control:

`Argentinos Juniors` + `Ferro Carril Oeste` + `21/03/2026` + `LHC` + `20:15`.

La coincidencia del marcador 20–27 por sí sola no será tratada como evidencia de planilla oficial.
