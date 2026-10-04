# TournamentTracker FEMEBAL — public build manifest (2026-10-04)

SAFE static evidence only. This document does **not** execute discovered API routes, does not resolve relative routes against an API host, and does not use credentials, cookies, tokens, Authorization headers, Supabase, or production writes.

## Active build

`asset-manifest.json` on the public Tecdata FEMEBAL TournamentTracker repository identifies:

- active JS: `static/js/main.2eefd057.js`
- active source map: `static/js/main.2eefd057.js.map`
- active JS Git blob SHA: `2a368d2de216274a226797334af3e074083d26a7`

The manifest is the authority for classifying a build as active. Presence in `static/js/` alone is not enough.

## Historical builds retained publicly

The same public directory currently retains these older main bundles/source maps:

| bundle | bundle Git blob SHA | bundle size | source map | source-map Git blob SHA | source-map size | classification |
|---|---|---:|---|---|---:|---|
| `main.150447f7.js` | `24ba5f42453c0ede6cf097c227843c6bb853b3ce` | 1,259,607 | `main.150447f7.js.map` | `e2ba7e0a8b9d0d4c60f9938e24be529255807014` | 5,770,866 | historical |
| `main.18bbe0b3.js` | `53cf401934f159d6cea6898bd03afa2a3f40dbf0` | 1,182,215 | `main.18bbe0b3.js.map` | `90b3eb1b558ab04751859c2fffae3583c2356703` | 5,473,348 | historical |
| `main.2795e4e3.js` | `117df6163ce7a0dabc6a7e3914f0ddef33621cfc` | 1,208,584 | `main.2795e4e3.js.map` | `fd8fe8f8808cc5495e3d4db9e6da0a0f859452f9` | 5,564,723 | historical |

`787.6621794f.chunk.js` and its source map are also present, but are not a `main.*` generation and must not be treated as a historical main build.

## Rules for differential analysis

1. Determine the active build from `asset-manifest.json`, never from directory ordering or filename sorting.
2. Bind every analyzed artifact to exact repository path + Git blob SHA + byte size before extracting evidence.
3. Keep active and historical evidence separate. A route/model found only in an older bundle is historical evidence, not proof of the current contract.
4. Static route discovery remains `probeAllowed=false` / `executionAllowed=false`.
5. Do not infer a base API host for relative paths during static analysis.
6. Do not execute source maps or JavaScript bundles.
7. Any future comparison of `Torneo`, `Partido`, `Planilla`, `/get-context`, `/torneos/...`, or related structures must record which exact build(s) contain the evidence.

## Control fixture

The eventual functional validation target remains the known control fixture:

- Argentinos Juniors 20–27 Ferro Carril Oeste
- 2026-03-21
- Apertura 2026 (`tournamentId=775` is existing project evidence)

This manifest does **not** claim that the active TournamentTracker response has been executed or that it independently confirms that score/PDF. It only establishes a reproducible, fail-closed basis for the next static differential-analysis step.
