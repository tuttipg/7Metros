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

for (const key of ['createMatch', 'deleteMatch', 'import_batch', 'insert-row', 'mutateRoster', 'removePlayer', 'resetTable', 'updateScore', 'uploadFile', 'writeV2']) {
  const candidate = classify(`https://www.femebal.com/api/matches?${key}=1`);
  assert.equal(candidate.state, 'rejected_on_policy_revalidation');
  assert.equal(candidate.reason, 'mutating_query_key');
  assert.equal(candidate.anonymousGetReviewable, false);
}

for (const key of ['access_token', 'apikey', 'api_key', 'auth', 'authorization', 'cookie', 'key', 'password', 'secret', 'session', 'token']) {
  const candidate = classify(`https://www.femebal.com/api/matches?${key}=redacted`);
  assert.equal(candidate.state, 'rejected_on_policy_revalidation');
  assert.equal(candidate.reason, 'sensitive_query_key');
  assert.equal(candidate.anonymousGetReviewable, false);
}

for (const key of ['accessToken', 'authToken', 'client_secret', 'sessionId', 'playerToken', 'passwordReset', 'apiKeyValue']) {
  const candidate = classify(`https://www.femebal.com/api/matches?${key}=redacted`);
  assert.equal(candidate.state, 'rejected_on_policy_revalidation');
  assert.equal(candidate.reason, 'sensitive_query_key');
  assert.equal(candidate.anonymousGetReviewable, false);
}

for (const key of ['action', 'method', 'op', 'operation']) {
  for (const value of ['create', 'delete', 'import', 'insert', 'mutate', 'remove', 'reset', 'update', 'upload', 'write']) {
    const candidate = classify(`https://www.femebal.com/api/matches?${key}=${value}`);
    assert.equal(candidate.state, 'rejected_on_policy_revalidation');
    assert.equal(candidate.reason, 'mutating_query_operation');
    assert.equal(candidate.anonymousGetReviewable, false);
  }

  for (const value of ['createMatch', 'deleteMatch', 'import_batch', 'insert-row', 'mutateRoster', 'removePlayer', 'reset:table', 'updateScore', 'upload/file', 'write.v2']) {
    const candidate = classify(`https://www.femebal.com/api/matches?${key}=${encodeURIComponent(value)}`);
    assert.equal(candidate.state, 'rejected_on_policy_revalidation');
    assert.equal(candidate.reason, 'mutating_query_operation');
    assert.equal(candidate.anonymousGetReviewable, false);
  }
}

for (const key of ['actionType', 'methodName', 'operationName', 'requestAction', 'requestMethod', 'requestOperation']) {
  for (const value of ['deleteMatch', 'updateScore', 'import_batch', 'write.v2']) {
    const candidate = classify(`https://www.femebal.com/api/matches?${key}=${encodeURIComponent(value)}`);
    assert.equal(candidate.state, 'rejected_on_policy_revalidation');
    assert.equal(candidate.reason, 'mutating_query_operation');
    assert.equal(candidate.anonymousGetReviewable, false);
  }
}

for (const value of ['read', 'list', 'getMatches', 'search']) {
  const candidate = classify(`https://www.femebal.com/api/matches?action=${value}`);
  assert.equal(candidate.state, 'femebal_public_get_reviewable');
  assert.equal(candidate.anonymousGetReviewable, true);
  assert.equal(candidate.probeAllowed, false);
}

for (const key of ['actionType', 'methodName', 'operationName', 'requestAction', 'requestMethod', 'requestOperation']) {
  const candidate = classify(`https://www.femebal.com/api/matches?${key}=getMatches`);
  assert.equal(candidate.state, 'femebal_public_get_reviewable');
  assert.equal(candidate.anonymousGetReviewable, true);
  assert.equal(candidate.probeAllowed, false);
}

const optionLike = classify('https://www.femebal.com/api/matches?option=update&season=2026');
assert.equal(optionLike.state, 'femebal_public_get_reviewable');
assert.equal(optionLike.anonymousGetReviewable, true);
assert.equal(optionLike.probeAllowed, false);

const benign = classify('https://www.femebal.com/api/matches?season=2026&category=LHC&sortKey=date');
assert.equal(benign.state, 'femebal_public_get_reviewable');
assert.equal(benign.anonymousGetReviewable, true);
assert.equal(benign.probeAllowed, false);
assert.equal(benign.authAllowed, false);
assert.equal(benign.writesAllowed, false);

console.log('TournamentTracker sensitive/mutating query policy SAFE smoke OK');
