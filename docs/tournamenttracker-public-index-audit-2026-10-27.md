# TournamentTracker — auditoría de evidencia pública indexada

Fecha de observación: 2026-10-27

## Objetivo

Buscar una relación pública y trazable entre el partido control y una ruta TournamentTracker, sin enumerar tokens, inferir IDs ni ejecutar endpoints candidatos.

Partido de control: **Argentinos Juniors 20–27 Ferro Carril Oeste**, 21/03/2026, Liga de Honor Caballeros Hipotecario Seguros, 20:15 (hora local).

## Fuentes observadas

1. La página oficial FEMEBAL **“Fixtures disponibles para la Liga de Honor Hipotecario Seguros y la Liga de Honor Plata”**, publicada el 24/02/2026, presenta enlaces públicos separados para las cuatro competiciones: LHC Hipotecario Seguros, LHD Hipotecario Seguros y ambas ramas de Liga de Honor Plata. Es evidencia de que FEMEBAL publicó enlaces oficiales a esos fixtures, no de una relación partido-planilla concreta.
   - https://femebal.com/fixtures-disponibles-para-la-liga-hipotecario-seguros-y-la-liga-plata/

2. La ruta pública del fixture LHC Caballeros registrada previamente en el manifiesto oficial es:
   - https://www.femebal.com/tournament-tracker/RUdVX3VheVA%3D
   - La consulta directa de la página pública devuelve sólo la carcasa de la aplicación y el mensaje de que se necesita JavaScript. Esta observación no autoriza a ejecutar bundles ni a descubrir/probar endpoints.

3. El índice público de buscadores sí expone otras rutas TournamentTracker con contenido renderizado/indexado:
   - https://www.femebal.com/tournament-tracker/RUdVX3RkflE%3D — la página indexada se identifica como **Torneo Metropolitano Clausura, Mayores, LHC Hipotecario Seguros, Masculino** y muestra encuentros de octubre de 2026.
   - https://www.femebal.com/tournament-tracker/RUdVX3Vkf1w%3D — la página indexada se identifica como **Super 8 Hipotecario Seguros Liga Honor Caballeros** y muestra cruces de marzo de 2026.
   Estas rutas son ejemplos de contenido público indexado de otras competiciones/etapas; **no** se consideran evidencia de la planilla del partido control ni se reinterpretan sus tokens.

## Resultado de la búsqueda del partido control

Las búsquedas públicas dirigidas a la combinación de clubes, marcador 20–27, fecha 21/03/2026, división LHC y el nombre de archivo conocido `5ce377051ea0acb1.pdf` no devolvieron una página TournamentTracker indexada que vincule inequívocamente ese partido con la planilla.

La programación oficial del sábado 21/03/2026 confirma que en AAAJ Globo hubo dos encuentros mayores Argentinos–Ferro: LHD femenino a las 18:30 y LHC masculino a las 20:15. Esa fuente valida el contexto del partido, pero es una **programación**, no la planilla final.

## Conclusión y siguiente paso

- Evidencia pública del fixture LHC Caballeros: **sí**.
- Ejemplos de páginas TournamentTracker de otras competiciones/etapas indexadas: **sí**.
- Ruta indexada que identifique inequívocamente el partido control: **no localizada en esta ejecución**.
- Enlace público independiente a la planilla final del control: **no localizado**.

No se infieren tokens ni se amplía la búsqueda enumerando rutas. El próximo avance requiere una referencia pública explícita que conecte el partido exacto con la planilla o con una página de detalle indexada.

## Estado SAFE

- Sin credenciales, cookies, tokens de sesión ni encabezados Authorization.
- Sin ejecución de bundles JavaScript ni llamadas a endpoints API candidatos.
- Sin probes automáticos.
- Sin escrituras en Supabase o producción.
- El manifiesto de evidencia sigue con `automatic_probe_allowed=false`, `match_rows_discovered_from_routes=0` y `match_sheets_discovered_from_routes=0` para las rutas previamente registradas.
