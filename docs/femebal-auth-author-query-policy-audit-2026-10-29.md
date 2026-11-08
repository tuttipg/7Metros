# SAFE audit: author filters versus authentication parameters

Date: 2026-10-29

## Finding

A cross-layer policy mismatch could classify benign query names such as `author` and `authorId` as authentication material in the Node.js official URL policy. The cause was treating every name beginning with the compact token `auth` as sensitive, even though the Python discovery tests explicitly allow these author filters.

The TournamentTracker static endpoint classifier also needed an explicit matching rule for auth-prefixed compound keys. The desired contract is:

- exact `auth`, and authentication-like compound keys such as `authValue`, `authToken`, `authenticationMethod`, and `authorToken`, remain rejected;
- benign `author` and `authorId` filters remain eligible for manual review;
- eligibility never enables automatic probing, authentication, or writes.

## Changes

- Exempted the `author...` namespace from the generic `auth` compound-token match in the official URL policy.
- Added a fail-closed rule for `auth...` compound keys in the TournamentTracker static endpoint classifier, excluding `author...`.
- Added regressions for `author`, `authorId`, `authValue`, and `authorToken` in the Node.js smoke tests.
- Aligned the Python sensitive-query classifier with the same distinction and added an `authValue` negative test. Existing Python tests already cover the positive `author` and `authorId` cases.

## Validation

The changes are included in `automation/femebal-public-discovery-safe-v3`. GitHub Actions is the authoritative test execution for this branch; do not treat source inspection alone as a passing test run.

## Safety

This is a local classification fix only. It does not send HTTP requests, change endpoint allowlists, execute remote JavaScript, use credentials, or enable Supabase writes.
