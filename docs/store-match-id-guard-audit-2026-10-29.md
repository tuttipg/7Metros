# Match ID guard regression audit — 2026-10-29

## Scope

This note records the additional regression coverage on PR #63 for the public-dataset boundary in `store.prepareDataset()`. It does not change Supabase, production data, importer permissions, or the FEMEBAL/n8n workflow.

## Contract under test

A match is accepted only when its ID is:
- a positive safe integer number; or
- a canonical decimal string representing a positive safe integer (for example `"208"`).

Values such as `null`, zero, negatives, fractions, unsafe integers, non-numeric strings, and non-canonical strings with leading zeroes (for example `"01"`) must be rejected before the match is inserted into `state.matches` or `state.index.matchById`.

## Additional regression cases

The store integrity smoke now checks both sides of the contract:

1. Canonical string ID `"208"` is normalized to numeric key `208` and retained.
2. Non-canonical ID `"01"` is rejected and must not create key `1`.
3. A participation referencing `partido_id=1` must not attach to the rejected `"01"` match.
4. The rejected participation must not contaminate the player's goals or matches-played totals.

This supplements the existing invalid-ID cases (null, non-numeric, zero, negative, fractional, unsafe integer) and the existing valid numeric match IDs.

## Verification

The previous PR head `5c002a32a8f5d41908bc7284b584abbe714ff06d` had a successful `Validate 7Metros` run, including `Store integrity smoke test`.

The additional test/documentation commits require a fresh CI run on the resulting PR head. No result is assumed until GitHub Actions reports it.

## Safety

- No Supabase calls or writes.
- No production changes.
- No credentials, cookies, tokens, or Authorization headers.
- No FEMEBAL endpoint probing or identifier enumeration.
