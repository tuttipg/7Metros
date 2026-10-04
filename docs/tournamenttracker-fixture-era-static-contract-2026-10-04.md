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

The source map restores the application-level `SystemClient` implementation and confirms these GET calls:

```ts
async getContextMenu() {
  const context = await this.requestHandler.get<string>(`/get-context`);
  const decryptedData = decrypt(context);
  return JSON.parse(decryptedData) as ContextMenu[];
}

async getTorneosXDivision(federacionId: string, temporadaId: string, rama: string, categoriaId: string) {
  const torneosXDivision = await this.requestHandler.get<string>(
    `/torneos-x-division/${federacionId}/${temporadaId}/${rama}/${categoriaId}`
  );
  // response is decrypted and parsed by the client
}

async getTorneo(torneoId: string) {
  const torneo = await this.requestHandler.get<string>(`/torneos/${torneoId}`);
  const decryptedData = decrypt(torneo);
  return JSON.parse(decryptedData) as Torneo;
}
```

Classification: **confirmed in fixture-era client code, not runtime-probed**. These routes remain `probeAllowed=false` in 7Metros.

## Confirmed fixture/planilla data contract

The restored TypeScript model shows that a `Partido` includes at least:

- `id`
- `idClubLocal`
- `idClubVisitante`
- `golesLocal`
- `golesVisitante`
- `nombreLocal`
- `nombreVisitante`
- local/visitor crest paths
- playing/played/pending-confirmation flags
- `numeroFecha`
- `planillas: Planilla[]`
- referees and venue metadata

A `Planilla` includes at least:

- `resultado_directo`
- `pdf`
- `url_transmision`
- `local: Equipo`
- `visitante: Equipo`

The UI enables **Ver planilla** only when at least one `planilla.pdf` is present. With exactly one PDF it opens that `pdf` value directly; with multiple planillas it presents a selector. The selector renders `planilla.local.goles - planilla.visitante.goles` and opens `planilla.pdf`. Transmission links are handled separately through `url_transmision`.

## Current-build static drift check

A second static-only extraction was performed against the currently active public build selected by `asset-manifest.json`:

- bundle: `static/js/main.2eefd057.js`
- source map blob SHA: `13d60111b2ca47b9831e70f9fd06a631fc7127ce`

The large source map was not treated as empty when the ordinary file reader returned an empty/truncated body. Instead, the immutable Git blob was inspected selectively without executing JavaScript or calling any discovered application endpoint.

For the fields and behavior relevant to the SAFE planilla path, **no contract drift was found** between the fixture-era snapshot and the current build:

- `getContextMenu()` still GETs `/get-context`, decrypts and parses the response.
- `getTorneosXDivision(...)` still GETs `/torneos-x-division/{federacionId}/{temporadaId}/{rama}/{categoriaId}`.
- `getTorneo(torneoId)` still GETs `/torneos/{torneoId}`, decrypts and parses it as `Torneo`.
- `Partido` still contains `numeroFecha` and `planillas: Planilla[]`.
- `Planilla` still contains `resultado_directo`, `pdf`, `url_transmision`, `local` and `visitante`.
- the current UI still counts non-empty `planilla.pdf` values; with exactly one it opens that explicit value with `window.open`, otherwise it opens the planilla selector.

Classification: **statically confirmed in both fixture-era and current public client builds; runtime/public accessibility remains unverified**.

This is evidence of client-contract continuity, not proof that the backend route is anonymous, that tournament `775` exists at runtime, or that the control fixture/PDF can currently be fetched.

## Consequence for 7Metros

This establishes a static fixture-era chain:

`/torneos/{torneoId}`
→ decrypted `Torneo`
→ fixture `Partido`
→ `Partido.planillas[]`
→ per-planilla local/visitor score
→ `Planilla.pdf`

The current-build comparison shows that this same client contract remains present in the active public bundle. Therefore, if a future separately-approved anonymous/public GET of tournament `775` is ever performed, the safe validator should not guess a PDF URL. It should require the returned tournament structure to identify the control match by date/teams, verify its 20–27 score, then obtain the PDF only from the explicit `planillas[].pdf` field and run the existing official-PDF allowlist/bounded-streaming/provenance gates.

## Negative/unknown findings

- This static analysis does **not** independently confirm tournament `775`.
- It does **not** independently confirm the control score 20–27.
- It does **not** identify the control match's `Partido.id`.
- It does **not** identify the control PDF URL.
- It does **not** prove that `/torneos/775` is currently anonymous/public.
- No endpoint was called as part of this analysis.

## Next safe task

The fixture-era/current-build drift check is now complete for the planilla path. The next safe task is to turn the confirmed stable contract into a deterministic, offline validator for a captured/decrypted `Torneo` fixture: identify a match by date and normalized team identity, require the expected score, require an explicit `planillas[].pdf`, and fail closed on ambiguity. Tests should use synthetic fixtures plus the already-known control expectations and must not perform network access. Runtime candidates remain fail-closed and manual-review-only.