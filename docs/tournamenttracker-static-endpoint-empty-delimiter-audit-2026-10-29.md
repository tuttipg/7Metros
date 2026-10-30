# TournamentTracker static endpoint: empty URL delimiters

Date: 2026-10-29

## Finding

The static endpoint candidate classifier used WHATWG `URL` fields to reject fragments. In JavaScript, a raw trailing `#` yields an empty `.hash`, and a raw trailing `?` yields an empty `.search`. Checking only those normalized fields therefore accepted two alternate raw spellings that the indexed-route and Python page canonicalizers already reject.

## Change

`n8n/tournamenttracker-static-endpoint-core.mjs` now checks the original literal before treating it as reviewable:

- any raw `#` is rejected as `fragment_not_allowed`;
- a raw `?` with an empty parsed search is rejected as `empty_query_not_allowed`.

The same classifier is used both during static extraction and during policy revalidation, so the guard covers candidates supplied by an untrusted or stale intermediate result as well.

## Regression coverage

`n8n/tournamenttracker-static-endpoint-core-smoke.mjs` now checks:

- extraction rejects literals ending in `?` or `#`;
- the expected rejected-candidate count includes both;
- policy revalidation independently rejects forged candidates with either delimiter;
- ordinary read-only query strings remain eligible for manual review only.

## Safety boundary

This is a static-validation change only. It does not perform HTTP requests, execute discovered JavaScript, authorize automatic probing, enable authentication, or enable writes. Supabase and production remain untouched.

## Validation status

The change and smoke regression were committed to `automation/femebal-public-discovery-safe-v3`. CI status must be read from the GitHub Actions run associated with the test commit; this document itself does not claim a passing result.
