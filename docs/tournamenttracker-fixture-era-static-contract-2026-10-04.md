# TournamentTracker fixture-era static contract — 2026-10-04

## Scope and safety

Static-only analysis of the public TournamentTracker source map associated with the historical snapshot immediately preceding the control fixture. No discovered route was executed. No credentials, cookies, tokens, Authorization headers, Supabase writes, or production writes were used.

Reference snapshot:

- repository: `Tecdata/larry-sport.handball.tournament-tracker-femebal`
- commit: `846652e8446d4acdabfea85810298127fcbd8b85` (2026-02-25)
- bundle: `static/js/main.69ca49ae.js`
- source map: `static/js/main.69ca49ae.js.map`
- control fixture for later independent validation: Argentinos Juniors 20–27 Ferro, 2026-03-21

This snapshot is temporal static evidence. It does not prove which bytes a browser received on match day and does not prove backend stability.

## Confirmed client routes

The source map restores the application-level `SystemClient` implementation and confirms GET calls for `/get-context`, `/torneos-x-division/{federacionId}/{temporadaId}/{rama}/{categoriaId}` and `/torneos/{torneoId}`. `getTorneo()` decrypts the response and parses it as `Torneo`.

Classification: **confirmed in fixture-era client code, not runtime-probed**. These routes remain `probeAllowed=false` in 7Metros.

## Confirmed Torneo → Partido nesting

A deeper static extraction of the same immutable source map confirms the exact container chain rather than inferring it from UI behavior:

- `Torneo.fases: Fase[]`
- `Fase.zonas: Zona[]`
- `Zona.partidos: Partido[]`

The fixture UI independently traverses `torneo.fases`, then each phase's `zonas`, and reads each zone's `partidos`. Therefore the offline adapter may deterministically flatten:

`Torneo.fases[] → Fase.zonas[] → Zona.partidos[]`

while retaining `fase.id` and `zona.id` as provenance. No alternate top-level `partidos` field is assumed.

## Confirmed fixture/planilla data contract

The restored TypeScript model shows that a `Partido` includes at least `id`, `idClubLocal`, `idClubVisitante`, `golesLocal`, `golesVisitante`, `nombreLocal`, `nombreVisitante`, `horario`, playing/played/pending-confirmation flags, `numeroFecha` and `planillas: Planilla[]`, plus referees and venue metadata. The UI derives a fixture date from `new Date(partido.horario)`.

A `Planilla` includes at least `resultado_directo`, `pdf`, `url_transmision`, `local: Equipo` and `visitante: Equipo`.

The UI enables **Ver planilla** only when at least one `planilla.pdf` is present. With exactly one PDF it opens that `pdf` value directly; with multiple planillas it presents a selector. Transmission links are handled separately through `url_transmision`.

## Current-build static drift check

A second static-only extraction was performed against the currently active public build selected by `asset-manifest.json` (`static/js/main.2eefd057.js`; source map blob SHA `13d60111b2ca47b9831e70f9fd06a631fc7127ce`). For the fields and behavior relevant to the SAFE planilla path, no contract drift was found: the routes, `Partido.planillas`, `Planilla.pdf` and explicit PDF-opening behavior remain present.

Classification: **statically confirmed in both fixture-era and current public client builds; runtime/public accessibility remains unverified**.

## Consequence for 7Metros

The static chain is now explicit:

`/torneos/{torneoId}`
→ decrypted `Torneo`
→ `fases[]`
→ `zonas[]`
→ `partidos[]`
→ exact `Partido`
→ `planillas[]`
→ `Planilla.pdf`

`n8n/tournamenttracker-torneo-adapter-core.mjs` implements only the offline structural transformation. It requires an explicitly offline/decrypted evidence envelope with `network_used=false`, `auth_used=false` and `write_enabled=false`; converts TournamentTracker score strings to non-negative integers; derives `YYYY-MM-DD` only from an explicit ISO-like `horario`; preserves tournament/phase/zone/match identifiers; and hands the normalized fixture to the existing fail-closed validator. It performs no network access.

The smoke regression uses the already-known control expectations (Argentinos Juniors 20–27 Ferro, 2026-03-21 and the previously known planilla filename) as synthetic input; it is a regression fixture, not new runtime evidence.

## Negative/unknown findings

- This static analysis does **not** independently confirm tournament `775` at runtime.
- It does **not** independently confirm the control score 20–27 from TournamentTracker runtime.
- It does **not** identify the control match's real `Partido.id`.
- It does **not** discover the control PDF URL from a live endpoint.
- It does **not** prove that `/torneos/775` is currently anonymous/public.
- No TournamentTracker/FEMEBAL application endpoint was called as part of this analysis.

## Next safe task

With the nesting and offline adapter now explicit, the next safe task is to strengthen provenance for captured/decrypted `Torneo` fixtures (source artifact hash, capture classification and immutable evidence metadata) before any future separately-approved anonymous/public GET is considered. Runtime candidates remain fail-closed and manual-review-only.