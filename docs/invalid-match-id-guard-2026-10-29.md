# Guard de ID de partido inválido — 2026-10-29

## Hallazgo

En `store.js`, `prepareDataset()` comprobaba que los equipos local y visitante existieran, pero construía la entidad con `id: Number(row.id)` sin validar la clave primaria. Como el resultado se filtraba únicamente con `.filter(Boolean)`, un partido con equipos válidos e ID no numérico podía entrar en `state.matches`; `null` y cadena vacía además se convierten a `0` con `Number()`.

## Corrección

Antes de resolver los equipos, el parser ahora exige un ID presente que se convierta en entero seguro positivo. Se rechazan valores ausentes/vacíos, no numéricos, cero, negativos, fraccionarios y fuera del rango entero seguro. Las cadenas numéricas positivas siguen siendo compatibles.

Las participaciones se mantienen sujetas a la validación de referencia contra `matchById`; una participación cuyo partido fue descartado no se conserva.

## Regresión

`store-smoke.mjs` incluye partidos sintéticos con IDs `null`, `not-numeric`, `0` y `202.5`, manteniendo equipos válidos. Las aserciones verifican que sólo los IDs válidos `201`, `203`, `202` lleguen a `state.matches` y al índice, y que participaciones huérfanas no sobrevivan.

## Alcance y seguridad

- Sólo cambia la validación de la capa cliente y su fixture local.
- No modifica Supabase, producción, endpoints ni datos reales.
- No se ejecutan escrituras ni se cambian permisos.
- La integración queda pendiente de CI verde sobre el HEAD exacto de esta rama.
