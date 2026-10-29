# FEMEBAL query policy: `author` false positive — 2026-10-29

## Finding

The Python and Node static discovery policies treated the compound token `auth` as a substring of every normalized query key. That also rejected benign keys such as `author` and `authorId`, because both begin with the letters `auth`. This was a false positive in the fail-closed policy, not evidence that those keys carried authentication material.

## Change

- Keep `auth` and `authorization` in the exact sensitive-key set.
- Replace the broad compound token `auth` with `authentication` in both Python and Node.
- Continue rejecting compound material such as `authTokenValue` through the existing `token` rule, and reject `authenticationMethod` through the explicit `authentication` compound token.
- Add positive regression cases for `author=club` and `authorId=club`; add negative cases for exact `auth` and compound `authenticationMethod`.

This changes classification only. Accepted candidates remain anonymous GET-only, require manual review, and retain `probeAllowed=false` / `automaticProbeAllowed=false`. No requests, credentials, Supabase operations, or production writes are involved.

## Validation

The Python regression is included in the existing unit-test suite. The Node regression is included in `n8n/tournamenttracker-static-endpoint-core-smoke.mjs`, which is part of the existing SAFE smoke workflow. CI must pass on the resulting branch head before this change is treated as verified.
