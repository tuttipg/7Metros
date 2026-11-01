# FEMEBAL raw-path canonicalization audit — 2026-10-27

## Finding

The Python discovery path validated the FEMEBAL host and raw control characters, but did not reject percent-encoded path spellings or literal `.`/`..` path segments for HTML pages. The page/PDF discovery loops and redirect handler call `urljoin`, which can normalize literal dot segments before downstream validation sees the original spelling.

The Node official-URL policy had the same gap for non-PDF FEMEBAL URLs: it checked raw control characters, then relied on `new URL()`, which normalizes dot segments. PDF paths already had a stricter rule.

## Change

- Reject percent-encoded paths and raw `.`/`..` segments before URL joining in Python page/PDF discovery and redirects.
- Apply the same rule to direct Python page canonicalization.
- Apply the fail-closed raw-path rule to Node official FEMEBAL page URLs while preserving percent-encoded values in ordinary read-only query filters.
- Add offline regressions for absolute URLs, relative links, redirect targets, page discovery, and the known control-planilla URL as a parser fixture.

## Validation contract

Tests use synthetic HTML and mocked redirect handling only. They do not access FEMEBAL, execute candidate endpoints, use authentication, or write to Supabase. The known control PDF URL is only a fixture for parser classification; this change does not claim it was newly discovered from a public page.

## Safety

GET-only discovery remains unchanged. No authentication, cookies, tokens, authorization headers, production writes, or automatic probing are enabled.
