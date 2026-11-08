# FEMEBAL 1.1.3 — reconciliación SAFE de estado de partidos

## Problema observado

Consulta read-only del proyecto 7Metros:

- Temporada local `Clausura 2026` (`temporada_id=3`): **2.689 partidos**.
- Los 2.689 tienen `estado='programado'`.
- Los 2.689 tienen fecha anterior al día de la auditoría (2026-11-08).
- Por lo tanto, el campo local actual expresa principalmente el estado de la **programación importada**, no el estado real y vigente del encuentro.

No se modificó Supabase.

## Fuente primaria para estado actual

La fuente primaria recomendada es FEMEBAL Community / LarrySport 1.1.3 mediante el flujo guest legítimo:

```text
POST /init-onboarding
GET /matches?tournamentId=...&...
GET /matches/{matchId}
```

El cliente 1.1.3 confirma filtros por `tournamentId`, `teamId`, `status`, `date`, `sortBy`, con paginación `limit + skip`.

Colecciones/ciclo confirmados en código:

- `scheduled`
- `live`
- `finalized`

El objeto Match conserva por separado:

- `status`
- `matchSheetStatus`
- `result` (en el modelo finalizado)
- `finishedAt` (cuando está disponible)

## Estados reconocidos por el cliente

### Estado del encuentro (`status`)

El cliente 1.1.3 reconoce explícitamente, entre otros:

- `programado`
- `reprogramado`
- `suspendido`
- `iniciado`
- `live`
- `finalizado`
- `finalized`
- `cancelado`
- variantes de `pendiente confirmacion resultado final`
- placeholders como `sin equipo asignado` / `disponible`

Clasificación interna:

- LiveMatch: `live` o `iniciado`
- FinalizedMatch: `finalized`, `finalizado` o `cancelado`
- ScheduledMatch: resto no-live/no-terminal

**Advertencia:** ScheduledMatch es una clase técnica de fallback; no equivale a decir que el raw status sea literalmente `programado`.

### Estado de planilla digital (`matchSheetStatus`)

Se maneja como dimensión distinta. El cliente reconoce:

- `iniciada`
- `en juego`
- `pend. confirmacion`
- variantes de `suspendida/suspendido pend. confirmacion`
- `finalizada` / `finalizado`
- `finalizada suspendida` / `finalizado suspendido`

El cliente cruza `status` + `matchSheetStatus` para mostrar el tag del partido. Por ejemplo, la condición interna `isInPlay` requiere simultáneamente `status='iniciado'` y `matchSheetStatus='en juego'`.

## Por qué "disputado" debe ser derivado

No se encontró `disputado` como raw status del cliente 1.1.3.

7Metros debería tratarlo como evidencia derivada, no como traducción directa:

- resultado oficial presente -> disputado confirmado;
- `iniciado/live` -> disputado/en curso confirmado;
- `finalizado/finalized` -> disputado y finalizado confirmado;
- `cancelado` -> terminal, pero **no** prueba que haya sido disputado;
- `suspendido` -> no permite saber por sí solo si llegó a comenzar;
- fecha pasada -> ninguna evidencia de disputa.

## Resultado oficial: dimensión separada

Regla fundamental:

```text
estado del encuentro != disponibilidad del resultado
```

Estados recomendados para `resultadoOficial` en el DRY RUN:

- `disponible`: `result.homeTeamGoals` y `result.awayTeamGoals` presentes, o fuente oficial equivalente;
- `pendiente_confirmacion`: raw status o planilla indica confirmación pendiente;
- `no_disponible`: no hay marcador oficial confirmado;
- `no_aplica`: cancelado sin resultado;
- `desconocido`: señal insuficiente/conflictiva.

Nunca completar un marcador por inferencia.

## Evidencia normativa oficial

El Reglamento General FEMEBAL establece que las categorías de Liga de Honor, Liga de Honor Plata, 1ª, 2ª e Inferiores A utilizan planilla digital online. También contempla explícitamente partidos que se suspenden y luego se reprograman. Esto confirma que "fecha programada" y "encuentro finalizado" son conceptos distintos y que el workflow debe preservar cambios de estado.

Fuentes públicas:

- https://femebal.com/wp-content/uploads/2026/01/202402_Reglamento_General_Femebal.pdf
- https://femebal.com/institucional/areas-femebal/

FEMEBAL describe además al área de Programación como responsable del "Sistema Larry" para programación/fixtures, mientras que otro frente del área realiza revisión de resultados y control de planillas digitales. No asumir que una programación publicada ya contiene la verdad posterior del resultado.

## Muestra real Clausura 2026

Se inspeccionaron sin escritura cuatro partidos de Ferro LHC Masculino existentes en Supabase.

| local id | fecha | partido | estado local | evidencia |
|---:|---|---|---|---|
| 153 | 08/08 | Ferro – Argentinos Juniors | programado | programación oficial normal; estado Larry actual aún no reconciliado |
| 137 | 22/08 | Vélez – Ferro | programado | programación oficial normal; estado Larry actual aún no reconciliado |
| 146 | 26/08 | Ferro – SAGAB | programado | **publicación oficial de reprogramaciones** |
| 156 | 29/08 | Ferro – Club Ferrocarril Mitre | programado | programación oficial normal; estado Larry actual aún no reconciliado |

El caso 146 demuestra un error semántico ya comprobable: la fila local sólo dice `programado`, pero su fuente oficial es una reprogramación.

La publicación FEMEBAL "Reprogramaciones 25 al 28 de agosto" y su PDF ubican Ferro–SAGAB LHC M el 26/08 a las 21:00.

Resultados encontrados en fuentes secundarias para otros partidos se guardan únicamente como pistas de auditoría y **no habilitan updates**. El CSV de muestra los marca expresamente como no autorizantes.

## IDs y joins

### Confirmado

```text
Tournament.id = tournamentId
  -> GET /matches?tournamentId=...

Team.id = teamId
  -> homeTeam.id / awayTeam.id
  -> filtro /matches?teamId=...

Match.id = matchId
  -> GET /matches/{matchId}
  -> subrecursos de partido
```

`matchId` es la clave canónica del encuentro.

### matchSheetId

`matchSheetId` está confirmado en registros `RefereeByMatch` y `CoachingStaffByMatch` junto a `matchId` (y `teamId` en coaching staff), pero no está confirmado como campo top-level de Match ni como ID del PDF.

No usar:

```text
matchSheetId == token/hash de planilla PDF
```

hasta demostrarlo con payload runtime.

### multidivisionId

Confirmado en el modelo de nivel de competencia/multidivisión, pero no como campo directo de Match.

## Política de reconciliación SAFE/DRY RUN

### 1. Resolver identidad

Prioridad:

1. `matchId` nativo ya conocido;
2. si todavía no existe mapping, reconciliación estricta sólo para preview por torneo + equipos nativos + fecha/hora + categoría/división/rama;
3. si hay 0 o >1 candidatos: `NO_OP_AMBIGUOUS`.

No adivinar IDs.

### 2. Leer estado oficial

Para cada partido candidato:

```text
GET /matches/{matchId}
```

Guardar en el artefacto DRY RUN:

- `matchId`
- `tournamentId`
- `homeTeam.id`
- `awayTeam.id`
- `date`
- `matchday`
- raw `status`
- raw `matchSheetStatus`
- `result` si existe
- `finishedAt` si existe
- timestamp de observación

### 3. Derivar preview sin escribir

| señal oficial | estadoActualDryRun | resultado |
|---|---|---|
| programado | programado | no disponible |
| reprogramado | reprogramado | no disponible |
| suspendido | suspendido | no disponible/pendiente según planilla |
| iniciado/live | en_curso | no asumir resultado final |
| pendiente confirmación final | pendiente_confirmacion | pendiente_confirmacion |
| finalizado/finalized + result | finalizado | disponible |
| finalizado/finalized sin result | finalizado | no_disponible + alerta |
| cancelado | cancelado | no_aplica salvo evidencia oficial distinta |
| desconocido/conflicto | desconocido | desconocido |

### 4. Preservar historial

Un partido puede ser:

```text
programado -> reprogramado -> iniciado -> suspendido -> reprogramado -> finalizado
```

Por eso `reprogramado` y `suspendido` no deben perderse al llegar a `finalizado`. En una futura migración conviene separar:

- estado actual;
- raw status de LarrySport;
- raw matchSheetStatus;
- flags/evidencia histórica (`fue_reprogramado`, `fue_suspendido`) o tabla de eventos;
- disponibilidad del resultado;
- `matchId`/IDs nativos y timestamp de última verificación.

No se propone esa migración en este frente: primero se valida el DRY RUN.

## Gates antes de cualquier escritura futura

Una propuesta sólo es promovible si:

1. match identity es unívoca;
2. `matchId`/torneo/equipos no presentan conflicto;
3. raw status pertenece al vocabulario conocido o fue revisado;
4. resultado no se infiere de la fecha;
5. marcador sólo se copia de `result`/fuente oficial;
6. `reprogramado`/suspendido preservan historial;
7. contradicción `status` vs `matchSheetStatus` => revisión manual;
8. `finalizado` sin `result` => revisión/no inventar marcador;
9. cualquier estado desconocido => no-op;
10. DRY RUN completo produce cero escrituras.

## Artefactos

- `data/femebal/discovery/matches/status_contract_1.1.3.json`
- `data/femebal/discovery/matches/status_sample_clausura_2026.csv`
- `tools/femebal_match_status_dry_run.py`

El script es offline: recibe JSON capturado legítimamente desde `/matches`, clasifica y emite preview. No hace red ni accede a Supabase.
