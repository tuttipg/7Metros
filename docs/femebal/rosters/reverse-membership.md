# Índice inverso de planteles — `athleteId -> team+tournament`

Fecha de evidencia: 2026-10-01.

## Endpoint

LarrySport/FEMEBAL Community 1.1.3 implementa:

```text
GET /athletes/{athleteId}/tournaments
```

Confirmado en código del bundle 1.1.3 y confirmado runtime mediante guest legítimo.

La respuesta observada es un array donde cada fila contiene exactamente:

```json
{
  "team": { "...": "Team" },
  "tournament": { "...": "Tournament" }
}
```

No se observaron campos adicionales de rol, dorsal, estado de membresía, alta/baja ni fechas propias de la relación.

## Qué representa

La evidencia runtime demuestra que funciona como un **índice inverso de membresías**:

```text
athleteId
  -> (teamId, tournamentId)[]
```

La identidad lógica sigue siendo:

```text
(teamId, tournamentId, athleteId)
```

No reemplaza el endpoint forward de roster. Lo complementa:

```text
Forward:
teamId + tournamentId
  -> GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
  -> athleteId[]

Reverse:
athleteId
  -> GET /athletes/{athleteId}/tournaments
  -> (team,tournament)[]
```

## Validación bidireccional

Se probaron cuatro atletas de dos clubes. Para cada par devuelto por el endpoint reverse se llamó al roster forward exacto y se comprobó que contuviera al mismo athleteId.

Resultado:

```text
13 pares reverse
13 pares confirmados en el roster forward
13/13 OK
```

Controles principales:

- Bartolomeo `16284`: `369/790`, `1843/775`, `369/1213`, `1843/1204`.
- Tonko Simunovic Granero `10565`: `3715/834`, `3715/1223`, `3256/1205`, `369/1213`.
- Schankula `19480`: `1843/776`, `1843/775`, `1843/1204`.
- Sebastian Alejandro Simonet `21150`, SAG Villa Ballester: `3291/775`, `3291/1204`.

Todos fueron confirmados por el endpoint forward correspondiente.

## Límite de `/teams/{teamId}/tournaments`

Se encontró una asimetría importante.

Para `teamId=1843`, en el mismo runtime:

```text
GET /teams/1843/tournaments
```

devolvió únicamente:

- `775` — Torneo Metropolitano Apertura 2026;
- `1204` — Torneo Metropolitano Clausura 2026.

Pero Schankula `19480` devolvió además en el índice inverso:

```text
teamId = 1843
tournamentId = 776
```

El roster forward `1843 + 776` respondió con 16 atletas e incluyó a `19480`. Por lo tanto, `1843/776` es una membresía válida aunque `776` no aparezca en `/teams/1843/tournaments`.

Conclusión: `/teams/{teamId}/tournaments` es útil para resolver competencias expuestas para un equipo, pero **no debe tratarse como historial exhaustivo de todas las membresías válidas**.

## Regla actualizada para Integración

Para resolver el pedido directo:

```text
club + temporada + categoría + división + rama
-> teamId
-> tournamentId
-> roster
```

se puede usar `/teams/{teamId}/tournaments` para localizar el torneo solicitado cuando éste aparece allí, y luego verificar el roster exacto.

Pero para descubrir o validar pertenencias ya asociadas a un atleta:

1. usar `GET /athletes/{athleteId}/tournaments`;
2. conservar cada `teamId+tournamentId` original;
3. comprobar el par con el roster forward cuando se necesite integridad fuerte;
4. no descartar una membresía únicamente porque el tournamentId no aparezca en `/teams/{teamId}/tournaments`.

## Calidad de metadata

Se observó:

```text
tournamentId 776
name: Super 8 Liga Hipotecario Seguros Masculino 2025
season.description: 2026
```

No corregir ni deducir la temporada desde el texto del nombre. Guardar IDs y metadata oficial tal como la API los entrega y resolver la semántica mediante campos estructurados/proveniencia.

## Qué sigue pendiente

Este endpoint no aporta:

- rol dentro del plantel;
- activo/baja explícito;
- fecha de alta/baja;
- ID propio de la membresía;
- dorsal scopeado al plantel;
- posición scopeada al plantel.

Esos campos siguen pendientes y no deben inferirse.
