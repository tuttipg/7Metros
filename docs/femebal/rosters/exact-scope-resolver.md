# Resolver exacto de planteles FEMEBAL 1.1.3

Fecha: 2026-10-02.

Objetivo:

```text
club + temporada + categoría + división + rama -> jugadores
```

La evidencia 1.1.3 obliga a tratar ese scope humano como **potencialmente ambiguo**. Para obtener un plantel reproducible hay que terminar resolviendo IDs originales FEMEBAL/LarrySport.

## Identidad canónica

```text
RosterMembership = (teamId, tournamentId, athleteId)
```

El resultado final nunca debe depender de joins principales por nombre.

## Ambigüedad 1: equipo A/B/C/D

Un mismo club puede tener más de un equipo dentro de una misma categoría/división/rama. Por eso:

```text
clubId + categoría + división + rama
```

no siempre determina un único `teamId`.

Si más de un equipo coincide, el resolver falla cerrado con:

```text
team_scope_ambiguous
```

y exige `teamId` o discriminador exacto de equipo (`A/B/C/D`, nombre/código oficial).

## Ambigüedad 2: más de un torneo en la misma temporada

Un `teamId` puede participar en Apertura y Clausura dentro de la misma temporada. Ejemplo confirmado para Ferro Mayores A `1843` en 2026:

```text
775  Torneo Metropolitano Apertura
1204 Torneo Metropolitano Clausura
```

Por lo tanto:

```text
club + temporada + categoría + división + rama
```

puede seguir siendo ambiguo incluso después de resolver el equipo.

Si hay más de un torneo de la misma temporada, el resolver falla cerrado con:

```text
tournament_scope_ambiguous
```

y exige `tournamentId` o competencia exacta.

## Pipeline seguro

```text
scope humano
  -> resolver teamId exacto
  -> resolver tournamentId exacto
  -> GET /athletes/athletesByTeam/{teamId}?tournamentId={tournamentId}
  -> validar athleteId no nulos y únicos
  -> RosterMembership[]
```

Opcionalmente, para integridad fuerte:

```text
athleteId
  -> GET /athletes/{athleteId}/tournaments
  -> comprobar que contiene el mismo teamId+tournamentId
```

La validación reverse fue confirmada 41/41 en los planteles completos Ferro `1843/775` y Ballester `3291/775`.

## Prohibiciones

No usar:

- `GET /athletes/athletesByTeam/{teamId}` sin `tournamentId`;
- deduplicación del roster sin torneo;
- `default-team` como historial de membresías;
- `club-id` como prueba suficiente de pertenencia;
- `formation.shirtNumber` como dorsal histórico de plantel;
- nombres de jugador para unir identidades.

## Implementación

Core puro y reutilizable:

```text
n8n/roster-resolver-core.mjs
```

Smoke test:

```text
n8n/roster-resolver-core-smoke.mjs
```

El smoke prueba explícitamente:

1. scope de equipo ambiguo A/B -> fail closed;
2. Apertura/Clausura en la misma temporada -> fail closed;
3. resolución exacta por `teamCode/teamId` y `tournamentId`;
4. generación de `(teamId,tournamentId,athleteId)`;
5. verificación reverse;
6. rechazo de `athleteId` duplicados dentro del roster exacto;
7. rechazo de mismatch forward↔reverse.

## Consecuencia para Integración

La API pública/guest 1.1.3 ya permite resolver jugadores de forma reproducible, pero el contrato real es más preciso que la frase inicial:

```text
club + temporada + categoría + división + rama
  -> posiblemente requiere equipo A/B/C/D
  -> posiblemente requiere competencia Apertura/Clausura/etc.
  -> teamId + tournamentId
  -> jugadores
```

La capa de Integración debe conservar esos discriminadores en vez de seleccionar silenciosamente el primer equipo o el primer torneo que coincida.
