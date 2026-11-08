# Auditoría SAFE: separadores ambiguos de query — 2026-10-29

## Hallazgo

Python `urllib.parse.parse_qsl` y WHATWG `URLSearchParams` no tratan el punto y coma como separador de parámetros. Por ejemplo, ambos interpretan:

```
?season=2026;deleteMatch=1
?season=2026%3BdeleteMatch=1
```

como un único parámetro `season`. Algunos servidores o frameworks pueden interpretar el punto y coma como separador adicional, creando una diferencia de interpretación entre el clasificador estático y el destino HTTP. En una política fail-closed esto podría ocultar un nombre operativo compuesto detrás de un valor aparentemente ordinario.

## Corrección

- El descubridor Python rechaza queries que contienen punto y coma literal o codificado como `%3B`.
- El clasificador estático TournamentTracker aplica la misma regla antes de marcar un candidato como revisable.
- El rechazo es conservador y sólo afecta URLs con query ambigua; los filtros normales separados por `&` continúan siendo admisibles para revisión manual.
- No se habilita probing automático, autenticación, ejecución de JavaScript ni escrituras.
- No se amplía la allowlist ni se consulta Supabase.

## Regresiones añadidas

Casos negativos en Python y Node.js:
- `season=2026;deleteMatch=1`
- `season=2026%3BdeleteMatch=1`
- `action=read;updateScore=27`

Caso positivo de control:
- `season=2026&category=LHC`

## Validación

El hallazgo se reprodujo localmente con las bibliotecas estándar: `parse_qsl` y `URLSearchParams` mantienen el segmento tras `;` dentro del valor de `season`, por lo que no detectan la segunda clave. La corrección y las regresiones quedaron incorporadas en el branch SAFE; la validación integral queda a cargo de GitHub Actions sobre el commit final.

## Alcance y límites

Este hallazgo no demuestra que un endpoint de FEMEBAL acepte semicolon-separated parameters ni que se haya ejecutado una operación. Es una defensa preventiva frente a diferencias conocidas entre parsers. La planilla del partido control Argentinos Juniors 20–27 Ferro del 21/03/2026 no se usó como evidencia para este hallazgo; no se hicieron nuevas peticiones a endpoints de aplicación ni se afirmó haber encontrado su planilla final.
