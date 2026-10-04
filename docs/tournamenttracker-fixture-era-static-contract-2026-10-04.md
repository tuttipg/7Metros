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

## Consequence for 7Metros

This establishes a static fixture-era chain:

`/torneos/{torneoId}`
→ decrypted `Torneo`
→ fixture `Partido`
→ `Partido.planillas[]`
→ per-planilla local/visitor score
→ `Planilla.pdf`

Therefore, if a future separately-approved anonymous/public GET of tournament `775` is ever performed, the safe validator should not guess a PDF URL. It should require the returned tournament structure to identify the control match by date/teams, verify its 20–27 score, then obtain the PDF only from the explicit `planillas[].pdf` field and run the existing official-PDF allowlist/bounded-streaming/provenance gates.

## Negative/unknown findings

- This static analysis does **not** independently confirm tournament `775`.
- It does **not** independently confirm the control score 20–27.
- It does **not** identify the control match's `Partido.id`.
- It does **not** identify the control PDF URL.
- It does **not** prove that `/torneos/775` is currently anonymous/public.
- No endpoint was called as part of this analysis.

## Next safe task

Compare this restored fixture-era `SystemClient`/models with the currently active TournamentTracker build. Record contract drift (route names, fields, planilla behavior) statically before considering any runtime validation. Runtime candidates remain fail-closed and manual-review-only.