# FEMEBAL public source inventory — 2026-09-17

SAFE/DRY RUN research snapshot. This file records only public, anonymous, official FEMEBAL pages observed through ordinary web indexing. It is evidence for discovery coverage, **not** authorization to infer or probe undocumented APIs.

## Verified official programming pages

- `https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/` — published 2026-03-20; exposes public download links for 21–24 March.
- `https://femebal.com/programacion-fecha-3-torneo-metropolitano-apertura-2026/` — published 2026-04-08; exposes Saturday/Sunday public downloads.
- `https://femebal.com/programacion-fecha-4-torneo-metropolitano-apertura-2026/` — published 2026-04-15; exposes Saturday/Sunday public downloads.
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

## Discovery consequence

Priority improvement: add an explicit, auditable historical-source input to `tools/femebal_public_discovery.py` (for example, user/repository-maintained canonical official page seeds) rather than synthesizing URLs or crawling search-engine result pages inside the importer. Seed URLs must pass the existing FEMEBAL HTTPS allowlist/canonicalization and normal page classification; a seed must never imply `probeAllowed=true`, authentication, or writes.

## TournamentTracker boundary

No new explicit public TournamentTracker data endpoint was verified in this snapshot. Keep static candidates fail-closed and `automaticProbeAllowed=false`. Do not infer API authorization from the JavaScript shell, opaque indexed route tokens, bundle strings, or authenticated Community behavior.

## Safety

No credentials, cookies, tokens, Authorization headers, authenticated endpoints, Supabase writes, or production mutations are required by this inventory.