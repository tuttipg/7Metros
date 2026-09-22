# FEMEBAL public source inventory — 2026-09-17

SAFE/DRY RUN research snapshot. This file records only public, anonymous, official FEMEBAL pages observed through ordinary web indexing. It is evidence for discovery coverage, **not** authorization to infer or probe undocumented APIs.

## Verified official programming pages

- `https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/` — published 2026-03-20; exposes public download links for 21–24 March. Re-verified 2026-09-22: the Saturday link resolves publicly and anonymously to `https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf` (`application/pdf`).
- `https://femebal.com/programacion-fecha-3-torneo-metropolitano-apertura-2026/` — published 2026-04-08; exposes Saturday/Sunday public downloads.
- `https://femebal.com/programacion-fecha-4-torneo-metropolitano-apertura-2026/` — published 2026-04-15; exposes Saturday/Sunday public downloads.
- `https://femebal.com/programacion-fecha-5-torneo-metropolitano-apertura-2026/` — published 2026-04-22; exposes Saturday/Sunday public downloads. Re-verified through ordinary public indexing on 2026-09-19 before retaining it in the seed inventory.
- `https://femebal.com/programacion-fecha-10-torneo-metropolitano-apertura-2026/` — published 2026-05-27; exposes Saturday/Sunday public downloads.
- `https://femebal.com/programacion-fecha-13-torneo-metropolitano-apertura-2026/` — published 2026-06-24; exposes Saturday/Sunday public downloads.
- `https://femebal.com/programacion-fecha-15-torneo-metropolitano-apertura-2026/` — published 2026-07-09; exposes Saturday/Sunday public downloads.

These pages remain individually public/indexed even though the current `https://femebal.com/programaciones/` listing is dominated by recent Clausura entries. Therefore a crawler that only consumes the current listing can under-discover older Apertura sources. This is a **coverage gap**, not evidence that guessing historical URLs is safe.

## Control match

The official public programming PDF for Saturday 2026-03-21 contains:

- category/division: Mayores — LHC Hipotecario Seguros;
- branch: M;
- local: Argentinos Juniors;
- visitor: Ferro Carril Oeste;
- scheduled time: 20:15.

This source supports scheduled-match identity only. It does **not** support the final 20–27 score or player statistics. The existing parser regression must continue to obtain score/statistics evidence from the official planilla path, not from programming.

On 2026-09-22 the public page→PDF chain above was re-verified without credentials, cookies, tokens or Authorization headers. The PDF still exposes the control row `Mayores / LHC Hipotecario Seguros / 20:15 / M / Argentinos Juniors / Ferro Carril Oeste`. This is useful as an independently reproducible identity anchor, but it must not be promoted to `planilla_partido_pdf`: its document type remains programming.

## Historical fixture/result pages and `Ver Planilla`

Ordinary public indexing also exposes legacy official FEMEBAL result pages under `/LH/`. A verified example is:

- `https://www.femebal.com/LH/fixture-libre.php?f=2&id=570` — indexed public result page observed 2026-09-22. Search-index content includes completed matches with score, date/time, venue, referees and a `Ver Planilla` action in the same match row (for example SAG Polvorines 34–27 SAG Villa Ballester E and Comunicaciones 33–19 Argentinos Juniors E, both 2024-03-24).

A second indexed family, `/LH/inferiores-libre.php`, shows the same public result-row shape and `Ver Planilla` action for youth matches. This is useful architectural evidence that FEMEBAL historically exposed a public result→planilla navigation path.

Safety boundary: the indexed page text does **not** expose the destination href of `Ver Planilla`, and the current research environment could not open the legacy page to inspect that href. Therefore this observation must not be used to synthesize, enumerate or probe planilla IDs, query parameters or undocumented routes. A future planilla destination is acceptable as discovery evidence only if its exact URL is observed in an explicit public FEMEBAL link or another ordinary public index result. The legacy 2024 pages are also not evidence that the same route family remains current in 2026.

A targeted public-index search on 2026-09-22 did not surface a 2026 `fixture-libre.php` page or planilla that independently proves the control result Argentinos Juniors 20–27 Ferro on 2026-03-21. Numeric/name matches from older documents were treated as false positives unless date, competition and match context also matched.

## Discovery consequence

The historical-source improvement is now implemented: `tools/femebal_public_discovery.py` loads repository-maintained canonical official page seeds from `config/femebal-public-page-seeds.json` and merges them with pages discovered from the live programming index. Seed URLs pass the same FEMEBAL HTTPS allowlist/canonicalization and normal page classification as index-discovered pages. The seed file itself is fail-closed (`schema_version`, `safe=true`, `auth_used=false`, `write_enabled=false`) and a seed never implies authentication, writes, planilla provenance, or permission to probe undocumented endpoints.

The current seed inventory contains only official pages independently observed through ordinary public indexing. Adding future historical seeds requires the same external evidence; do not synthesize or enumerate likely date/round URLs.

## TournamentTracker boundary

A fresh ordinary public-index search on 2026-09-22 did not surface a new explicit public TournamentTracker data endpoint or a control-match planilla link. This negative result is **not** evidence that such a source does not exist; it only means no new source was verified in this pass. Keep static candidates fail-closed and `automaticProbeAllowed=false`. Do not infer API authorization from the JavaScript shell, opaque indexed route tokens, bundle strings, authenticated Community behavior, or from the programming PDF above.

## Safety

No credentials, cookies, tokens, Authorization headers, authenticated endpoints, Supabase writes, or production mutations are required by this inventory.
