# Modelo de acceso de la planilla digital FEMEBAL — 2026-10-29

## Fuente oficial nueva

**Fe.Me.Bal., Boletín Informativo N.º 12 — Carga Planilla Digital, año 2026**, publicado el 23/12/2025:

- Página del boletín: https://femebal.com/boletin-informativo-no-12/
- PDF oficial: https://femebal.com/wp-content/uploads/2026/01/Boletin-Informativo-N%C2%B0-12.-Planilla-Digital.-Ano-2026.pdf

El boletín establece que durante 2026 la carga de planillas digitales debe ser online para todas las categorías y divisiones. Indica que el club local debe disponer de computadora e Internet y acceder con el usuario de planillero y contraseña asignados por la Secretaría Administrativa. También exige confeccionar planilla de papel como respaldo ante errores o problemas de conexión.

## Qué demuestra y qué no

- **Demuestra:** la carga oficial de la planilla digital se realiza en un flujo con credenciales de planillero asignadas por FEMEBAL.
- **No demuestra:** que la planilla final sea necesariamente inaccesible al público una vez finalizado el partido, ni que no exista una exportación pública independiente.
- **No se infiere:** que un PDF de programación sea una planilla estadística, ni que una ruta conocida de PDF sea evidencia de un enlace público real.

## Aplicación al partido de control

El partido de control es Argentinos Juniors 20–27 Ferro Carril Oeste, masculino LHC, 21/03/2026 a las 20:15. La programación oficial confirma el encuentro; el resultado indexado de TournamentTracker corrobora el marcador, pero el shell HTML abierto no expone la planilla ni las estadísticas individuales sin JavaScript.

La búsqueda pública realizada el 29/10/2026 no encontró un enlace oficial explícito a la planilla final del partido. Por eso, la integración no debe intentar entrar al flujo de planillero, solicitar o reutilizar credenciales, inferir rutas ni enumerar identificadores.

## Próximo paso legítimo

Continuar únicamente con páginas y enlaces públicos explícitos de FEMEBAL. Si la planilla final no está publicada de esa manera, el bloqueo concreto es obtener una referencia pública oficial al documento o una confirmación de FEMEBAL/club de que existe una exportación pública. No es necesario ni apropiado acceder al flujo de carga autenticado para seguir investigando el descubrimiento público.

## Seguridad

- Sin credenciales, cookies, tokens ni encabezados `Authorization`.
- Sin ejecución de JavaScript remoto ni llamadas a endpoints internos.
- Sin enumeración de identificadores.
- Sin escrituras en Supabase o producción.
- El marcador indexado no sustituye el PDF final ni su SHA-256.
