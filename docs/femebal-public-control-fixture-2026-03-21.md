# FEMEBAL — evidencia pública del partido control (21/03/2026)

Fecha de verificación del fixture oficial: 2026-10-27  
Fecha de revisión de la ruta pública TournamentTracker: 2026-10-28

## Fuente primaria

- Página oficial de programación: https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/
- PDF oficial enlazado por esa página: https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf

La página se titula **“Programación Fecha 1 – Torneo Metropolitano Apertura 2026”** y está fechada el 20/03/2026. Su enlace “Sábado 21-3 / Descarga” apunta al PDF de programación del sábado.

## Validación del partido control

En la página 1 del PDF, la sede aparece como **AAAJ Globo (Argentinos Juniors)**. La tabla contiene, entre otros, estos registros del 21/03/2026:

- Mayores — LHD Hipotecario Seguros — 18:30 — rama F — Argentinos Juniors vs. Ferro Carril Oeste.
- Mayores — LHC Hipotecario Seguros — 20:15 — rama M — Argentinos Juniors vs. Ferro Carril Oeste.

Esto valida independientemente la identidad, rama, división y hora del partido masculino usado como control: **Argentinos Juniors 20–27 Ferro Carril Oeste, 21/03/2026, LHC, 20:15**. También demuestra por qué la fecha por sí sola no basta: el mismo día hubo un encuentro femenino entre los mismos clubes a las 18:30.

## Límite de la evidencia del fixture

El PDF es una **programación**, no la planilla oficial del partido ni una planilla de estadísticas final. La página y el PDF no muestran una URL TournamentTracker ni vinculan el identificador conocido `5ce377051ea0acb1.pdf`.

La página histórica pública de fixtures LHC con enlaces “Ver Planilla” sirve como evidencia de que FEMEBAL ha publicado enlaces de planillas en otras temporadas, pero no autoriza a inferir IDs de fixtures 2026 ni a enumerar parámetros. La planilla de control sigue siendo un artefacto de regresión conocido hasta que aparezca un enlace público independiente y trazable.

## Ruta pública TournamentTracker — evidencia separada

En el registro de revisión del PR #34 del 27/10/2026 quedó documentado que la página pública de FEMEBAL titulada **“Fixtures disponibles para la Liga de Honor Hipotecario Seguros y la Liga de Honor Plata”** enlaza explícitamente el fixture LHC Caballeros a esta ruta:

- https://www.femebal.com/tournament-tracker/RUdVX3VheVA=
- Registro de esa observación: https://github.com/tuttipg/7Metros/pull/34#pullrequestreview-5663661126

La ruta usa un token opaco proveniente de un enlace público observado; no fue inferido por enumeración. El 28/10/2026 se abrió esa URL pública y la respuesta textual visible fue únicamente **“You need to enable JavaScript to run this app.”** Por lo tanto, se confirmó que la superficie pública responde con un shell SPA, pero esta inspección no expuso partidos, marcador, enlace de planilla ni el partido control.

Esta evidencia acredita una **entrada pública al fixture LHC**, no la presencia del encuentro Argentinos Juniors 20–27 Ferro del 21/03/2026 ni la disponibilidad de su planilla. No se ejecutó JavaScript ni se intentó descubrir rutas o IDs derivados del token.

## Nueva ruta LHC masculina observada en índice público (28/10/2026)

Una búsqueda pública reciente devolvió otra página FEMEBAL/TournamentTracker indexada:

- URL observada: https://www.femebal.com/tournament-tracker/RUdVX3RkflE%3D
- Resultado indexado: https://www.femebal.com/tournament-tracker/RUdVX3RkflE%3D
- Título/clasificación visible en el índice: **Torneo Metropolitano Clausura | Mayores - LHC Hipotecario Seguros - Masculino**.
- Actualización indicada por el resultado: **26/10/2026 14:47**.
- Muestra indexada: partidos de la Fecha 11 del Clausura, incluidos encuentros del 22–24/10/2026.

El token de la ruta se tomó literalmente de un resultado público indexado; no se generó, modificó ni enumeró. La página abierta directamente volvió a mostrar únicamente el shell **“You need to enable JavaScript to run this app.”**; por eso, los datos visibles proceden del índice público y no de una inspección completa de la aplicación.

Esta ruta es una fuente nueva y útil para confirmar que existe una superficie TournamentTracker indexada para **LHC masculina del Clausura 2026**, pero **no es evidencia del partido control de marzo**: la muestra corresponde a la Fecha 11 de octubre. La búsqueda exacta no aportó una página indexada que vincule el encuentro del 21/03/2026 con su planilla. No se siguieron rutas derivadas, no se enumeraron tokens y no se hicieron probes a endpoints internos.

## Estado SAFE

- Fixture oficial: **confirmado** mediante la programación pública FEMEBAL.
- Ruta pública de entrada al fixture LHC: **enlace explícito registrado; shell SPA observado el 28/10/2026**.
- Ruta LHC masculina de Clausura 2026: **encontrada en índice público; muestra de octubre, no el partido control**.
- Partido control dentro de TournamentTracker: **no verificado**.
- Planilla pública FEMEBAL trazable al partido: **pendiente**.
- Sólo se consultaron páginas públicas e índices; no se enumeraron IDs ni se infirieron rutas.
- Sin autenticación, cookies, tokens de sesión ni encabezados de autorización.
- Sin ejecución de JavaScript remoto.
- Sin escrituras en Supabase ni producción.
