# TournamentTracker FEMEBAL — public build manifest (2026-10-04)

SAFE static evidence only. This document does **not** execute discovered API routes, does not resolve relative routes against an API host, and does not use credentials, cookies, tokens, Authorization headers, Supabase, or production writes.

## Active build

`asset-manifest.json` on the public Tecdata FEMEBAL TournamentTracker repository identifies:

- active JS: `static/js/main.2eefd057.js`
- active source map: `static/js/main.2eefd057.js.map`
- active JS Git blob SHA: `2a368d2de216274a226797334af3e074083d26a7`

The manifest is the authority for classifying a build as active. Presence in `static/js/` alone is not enough.

## Historical build nearest the control fixture

For the control fixture on 2026-03-21, the latest public commit touching `asset-manifest.json` at or before the fixture date is:

- commit: `846652e8446d4acdabfea85810298127fcbd8b85`
- commit date: `2026-02-25T18:02:40Z`
- commit message: `fix, heigth container`
- manifest JS: `static/js/main.69ca49ae.js`
- bundle Git blob SHA: `429a457cd089db2d417cecd78477ef12f704d546`
- bundle size: `1,208,688` bytes
- source map: `static/js/main.69ca49ae.js.map`
- source-map Git blob SHA: `93c5abf7923d9bdb731d277c597757b8199c946c`
- source-map size: `5,564,886` bytes

The preceding `asset-manifest.json` change is `b86fd6884b1e3162bdde9bec9be98cd79bba0dbd` from 2026-02-20. The public commit history query through the end of 2026-03-21 returns no later `asset-manifest.json` change after `846652e...` and before the fixture date. Therefore `main.69ca49ae.js` is the best repository-backed static snapshot currently available for analysis of the frontend around the fixture date.

This is **temporal repository evidence**, not proof of what bytes a particular browser received on 2026-03-21 and not proof that the backend contract was unchanged. It must not be upgraded to runtime evidence.

## Historical builds retained publicly

The same public tree at the fixture-era commit retains multiple older main bundles/source maps. Selected generations already catalogued are:

| bundle | bundle Git blob SHA | bundle size | source map | source-map Git blob SHA | source-map size | classification |
|---|---|---:|---|---|---:|---|
| `main.69ca49ae.js` | `429a457cd089db2d417cecd78477ef12f704d546` | 1,208,688 | `main.69ca49ae.js.map` | `93c5abf7923d9bdb731d277c597757b8199c946c` | 5,564,886 | fixture-era snapshot |
| `main.150447f7.js` | `24ba5f42453c0ede6cf097c227843c6bb853b3ce` | 1,259,607 | `main.150447f7.js.map` | `e2ba7e0a8b9d0d4c60f9938e24be529255807014` | 5,770,866 | historical |
| `main.18bbe0b3.js` | `53cf401934f159d6cea6898bd03afa2a3f40dbf0` | 1,182,215 | `main.18bbe0b3.js.map` | `90b3eb1b558ab04751859c2fffae3583c2356703` | 5,473,348 | historical |
| `main.2795e4e3.js` | `117df6163ce7a0dabc6a7e3914f0ddef33621cfc` | 1,208,584 | `main.2795e4e3.js.map` | `fd8fe8f8808cc5495e3d4db9e6da0a0f859452f9` | 5,564,723 | historical |

`787.6621794f.chunk.js` and its source map are also present, but are not a `main.*` generation and must not be treated as a historical main build.

## Rules for differential analysis

1. Determine the active build from `asset-manifest.json`, never from directory ordering or filename sorting.
2. For historical questions, select the latest manifest commit at or before the target time and record the temporal boundary explicitly.
3. Bind every analyzed artifact to exact repository path + Git blob SHA + byte size before extracting evidence.
4. Keep active, fixture-era, and older historical evidence separate. A route/model found only in an older bundle is historical evidence, not proof of the current contract.
5. Static route discovery remains `probeAllowed=false` / `executionAllowed=false`.
6. Do not infer a base API host for relative paths during static analysis.
7. Do not execute source maps or JavaScript bundles.
8. Any future comparison of `Torneo`, `Partido`, `Planilla`, `/get-context`, `/torneos/...`, or related structures must record which exact build(s) contain the evidence.
9. A repository snapshot is not runtime proof; backend responses, score, PDF identity, and deployment state require separate evidence.

## Control fixture

The eventual functional validation target remains the known control fixture:

- Argentinos Juniors 20–27 Ferro Carril Oeste
- 2026-03-21
- Apertura 2026 (`tournamentId=775` is existing project evidence)

The fixture-era snapshot now gives us a reproducible static artifact to inspect next: `main.69ca49ae.js.map` at blob `93c5abf7923d9bdb731d277c597757b8199c946c`. This manifest does **not** claim that TournamentTracker was executed or that it independently confirms the score/PDF.
