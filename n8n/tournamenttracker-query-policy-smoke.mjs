import assert from 'node:assert/strict';
import { classifyTournamentTrackerCandidatePolicy } from './tournamenttracker-static-endpoint-core.mjs';

function extractionWith(url) {
  return {
    safe: true,
    dry_run: true,
    sourceValidated: true,
    state: 'static_candidates_only',
    probeAllowed: false,
    executionAllowed: false,
    constraints: {
      automaticProbingAllowed: false,
      sourceBodyIntegrityRequired: true,
    },
    candidates: [{
      url,
      hostScope: 'femebal_same_organization',
      evidence: 'explicit_https_string_literal',
      probeAllowed: false,
      requiresPolicyReview: true,
    }],
  };
}

function classify(url) {
  return classifyTournamentTrackerCandidatePolicy(extractionWith(url)).candidates[0];
}

for (const key of ['create', 'delete', 'import', 'insert', 'mutate', 'remove', 'reset', 'update', 'upload', 'write']) {
  const candidate = classify(`https://www.femebal.com/api/matches?${key}=1`);
  assert.equal(candidate.state, 'rejected_on_policy_revalidation');
  assert.equal(candidate.reason, 'mutating_query_key');
  assert.equal(candidate.anonymousGetReviewable, false);
}

for (const key of ['action', 'method', 'op', 'operation']) {
  for (const value of ['create', 'delete', 'import', 'insert', 'mutate', 'remove', 'reset', 'update', 'upload', 'write']) {
    const candidate = classify(`https://www.femebal.com/api/matches?${key}=${value}`);
    assert.equal(candidate.state, 'rejected_on_policy_revalidation');
    assert.equal(candidate.reason, 'mutating_query_operation');
    assert.equal(candidate.anonymousGetReviewable, false);
  }
}

const benign = classify('https://www.femebal.com/api/matches?season=2026&category=LHC');
assert.equal(benign.state, 'femebal_public_get_reviewable');
assert.equal(benign.anonymousGetReviewable, true);
assert.equal(benign.probeAllowed, false);
assert.equal(benign.authAllowed, false);
assert.equal(benign.writesAllowed, false);

console.log('TournamentTracker mutating query policy SAFE smoke OK');
