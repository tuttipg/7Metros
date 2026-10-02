# `athletesByTeam` sin `tournamentId` — semántica observada

Fecha de evidencia: 2026-10-01.

Este documento cubre sólo `teamId=1843` (Ferro Carril Oeste, Mayores A) y explica por qué la variante sin torneo NO puede usarse para construir un plantel exacto.

## Resultado confirmado runtime

La llamada:

```text
GET /athletes/athletesByTeam/1843
```

devuelve:

- 106 filas;
- 31 athleteId únicos;
- cada fila sólo contiene identidad del atleta.

Se recuperaron seis rosters exactos conocidos para el mismo `teamId`:

| tournamentId | temporada | competencia | filas |
| ---: | --- | --- | ---: |
| 218 | 2025 | Torneo Metropolitano Apertura | 20 |
| 219 | 2025 | Super 8 Hipotecario Seguros Liga Honor Caballeros | 16 |
| 526 | 2025 | Torneo Metropolitano Clausura | 19 |
| 775 | 2026 | Torneo Metropolitano Apertura | 16 |
| 776 | 2026 | Super 8 Liga Hipotecario Seguros Masculino 2025 | 16 |
| 1204 | 2026 | Torneo Metropolitano Clausura | 19 |

La suma es:

```text
20 + 16 + 19 + 16 + 16 + 19 = 106
```

La unión de athleteIds de esos seis rosters contiene exactamente 31 IDs, igual que la respuesta sin torneo.

## Prueba multiset

No sólo coincide el conjunto de IDs. También se comparó cuántas veces aparece cada athleteId.

Resultado:

```text
unscoped rows                 = 106
sum exact roster rows         = 106
unscoped unique athleteIds    = 31
exact-roster union unique     = 31
set equality                  = true
per-athlete frequency equality= true
multiset equality             = true
```

Por lo tanto, para `teamId=1843` en este runtime, la interpretación confirmada es:

> La respuesta sin `tournamentId` es exactamente la concatenación de los seis rosters tournament-scoped conocidos, pero cada fila perdió el contexto que identifica de qué torneo provino.

Ejemplos de multiplicidad:

- `19470` aparece 6 veces: está en los seis rosters.
- `19480` aparece 6 veces.
- `16299` aparece 5 veces.
- `16284` aparece 3 veces.
- varios atletas aparecen sólo una vez.

La multiplicidad coincide exactamente con la cantidad de esos seis rosters que contienen cada athleteId.

## Por qué deduplicar NO sirve

Deduplicar 106 filas a 31 atletas responde algo parecido a:

```text
¿Qué atletas estuvieron asociados a este teamId en alguno de estos torneos?
```

pero no permite saber:

```text
¿qué atletas integraban ESTE torneo concreto?
```

Después de perder el `tournamentId`, no existe información en esas filas que permita reconstruir qué repetición corresponde a Apertura, Clausura, Super 8, 2025 o 2026.

Regla de Integración:

```text
Nunca crear RosterMembership desde
GET /athletes/athletesByTeam/{teamId}
sin tournamentId.
```

Siempre usar:

```text
GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
```

## Cómo se descubrieron los torneos históricos

`GET /teams/1843/tournaments` sólo exponía `775` y `1204` en el runtime observado. El índice inverso de atletas permitió encontrar además pares válidos de `teamId=1843` vinculados a `776`, `218`, `219` y `526`.

Luego cada tournamentId fue validado con el roster forward exacto.

Esto confirma dos límites distintos:

1. `/teams/{teamId}/tournaments` no es un historial exhaustivo de todas las membresías válidas.
2. `/athletes/{athleteId}/tournaments` es un índice inverso útil y fuertemente validado, pero tampoco debe asumirse como historial exhaustivo global: algunos atletas de rosters exactos antiguos no expusieron actualmente el par histórico esperado.

Para dos planteles completos de 2026, el reverse sí cerró 41/41 sin faltantes.

## Evidencia machine-readable

`data/femebal/discovery/rosters/ferro-1843-unscoped-multiset-semantics-2026-10-01.json`

Contrato de Integración actualizado:

`data/femebal/discovery/rosters/roster-integration-contract-v1.json`
