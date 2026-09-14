import assert from 'node:assert/strict';
import { classifyTournamentTrackerStaticAssetResponse } from './tournamenttracker-public-core.mjs';
import {
  classifyTournamentTrackerCandidatePolicy,
  extractTournamentTrackerExplicitHttpsCandidates,
} from './tournamenttracker-static-endpoint-core.mjs';

function classifyBody(body) {
  return classifyTournamentTrackerStaticAssetResponse({
    statusCode: 200,
    body,
    contentType: 'application/javascript',
    finalUrl: 'https://www.femebal.com/tournament-tracker/static/js/main.js',
  });
}

const unvalidated = extractTournamentTrackerExplicitHttpsCandidates({
  body: 'const x = "https://www.femebal.com/api/matches";',
  assetClassification: { analyzableStaticJavascript: false },
});
assert.equal(unvalidated.state, 'source_not_validated');
assert.equal(unvalidated.sourceValidated, false);
assert.deepEqual(unvalidated.candidates, []);
assert.equal(unvalidated.probeAllowed, false);

const body = `
  const same = "https://www.femebal.com/api/matches?season=2026";
  const duplicate = 'https://www.femebal.com/api/matches?season=2026';
  const external = "https://public.example.org/v1/fixtures";
  const root = "https://www.femebal.com/";
  const sensitive = "https://www.femebal.com/api/matches?token=secret";
  const creds = "https://user:pass@www.femebal.com/api/matches";
  const fragment = "https://www.femebal.com/api/matches#private";
  const interpolated = \`https://www.femebal.com/api/matches/\${id}\`;
  const relative = "/api/matches";
  const concatenatedAfter = "https://www.femebal.com/api/" + matchId;
  const concatenatedBefore = apiBase + "https://www.femebal.com/v1/";
  const encodedPath = "https://www.femebal.com/%61dmin/matches";
  const nonstandardPort = "https://www.femebal.com:8443/api/matches";
  const insecure = "http://www.femebal.com/api/matches";
`;
const validatedAsset = classifyBody(body);
assert.equal(validatedAsset.state, 'public_static_javascript');
assert.match(validatedAsset.bodySha256, /^[0-9a-f]{64}$/);

const extracted = extractTournamentTrackerExplicitHttpsCandidates({
  body,
  assetClassification: validatedAsset,
});

assert.equal(extracted.state, 'static_candidates_only');
assert.equal(extracted.safe, true);
assert.equal(extracted.dry_run, true);
assert.equal(extracted.sourceValidated, true);
assert.equal(extracted.executionAllowed, false);
assert.equal(extracted.probeAllowed, false);
assert.equal(extracted.constraints.relativeResolutionAllowed, false);
assert.equal(extracted.constraints.concatenationAllowed, false);
assert.equal(extracted.constraints.templateEvaluationAllowed, false);
assert.equal(extracted.constraints.javascriptExecutionAllowed, false);
assert.equal(extracted.constraints.automaticProbingAllowed, false);
assert.equal(extracted.constraints.sourceBodyIntegrityRequired, true);
assert.equal(extracted.constraints.percentEncodedPathsAllowed, false);
assert.equal(extracted.constraints.nonstandardHttpsPortsAllowed, false);
assert.equal(extracted.constraints.ambiguousRawUrlCharactersAllowed, false);

assert.deepEqual(extracted.candidates, [
  {
    url: 'https://public.example.org/v1/fixtures',
    hostScope: 'external_untrusted',
    evidence: 'explicit_https_string_literal',
    probeAllowed: false,
    requiresPolicyReview: true,
  },
  {
    url: 'https://www.femebal.com/api/matches?season=2026',
    hostScope: 'femebal_same_organization',
    evidence: 'explicit_https_string_literal',
    probeAllowed: false,
    requiresPolicyReview: true,
  },
]);
assert.equal(extracted.rejectedCount, 9);
assert.equal(extracted.candidates.some((item) => /secret|pass|token=/i.test(item.url)), false);
assert.equal(extracted.candidates.some((item) => item.url.endsWith('/api/') || item.url.endsWith('/v1/')), false);

const policy = classifyTournamentTrackerCandidatePolicy(extracted);
assert.equal(policy.state, 'policy_classified_candidates');
assert.equal(policy.probeAllowed, false);
assert.equal(policy.automaticProbingAllowed, false);
assert.equal(policy.writesAllowed, false);
assert.equal(policy.authAllowed, false);
assert.equal(policy.constraints.manualReviewRequiredBeforeAnyGet, true);
assert.equal(policy.constraints.percentEncodedPathsBlocked, true);
assert.equal(policy.constraints.nonstandardHttpsPortsBlocked, true);
assert.equal(policy.constraints.ambiguousRawUrlCharactersBlocked, true);
assert.deepEqual(policy.candidates, [
  {
    url: 'https://public.example.org/v1/fixtures',
    state: 'external_untrusted',
    hostScope: 'external_untrusted',
    probeAllowed: false,
    anonymousGetReviewable: false,
    manualReviewRequired: true,
  },
  {
    url: 'https://www.femebal.com/api/matches?season=2026',
    state: 'femebal_public_get_reviewable',
    hostScope: 'femebal_same_organization',
    probeAllowed: false,
    anonymousGetReviewable: true,
    manualReviewRequired: true,
    allowedMethodIfReviewed: 'GET',
    authAllowed: false,
    writesAllowed: false,
  },
]);

// Policy revalidates URLs instead of trusting extractor metadata.
const forgedScope = structuredClone(extracted);
forgedScope.candidates[0].hostScope = 'femebal_same_organization';
const forgedScopePolicy = classifyTournamentTrackerCandidatePolicy(forgedScope);
assert.equal(forgedScopePolicy.candidates[0].state, 'external_untrusted');
assert.equal(forgedScopePolicy.candidates[0].anonymousGetReviewable, false);

const forgedAmbiguous = structuredClone(extracted);
forgedAmbiguous.candidates.push(
  {
    url: 'https://www.femebal.com/%61dmin/matches',
    hostScope: 'femebal_same_organization',
    evidence: 'explicit_https_string_literal',
    probeAllowed: false,
    requiresPolicyReview: true,
  },
  {
    url: 'https://www.femebal.com:8443/api/matches',
    hostScope: 'femebal_same_organization',
    evidence: 'explicit_https_string_literal',
    probeAllowed: false,
    requiresPolicyReview: true,
  },
  {
    url: 'https://www.femebal.com\\admin/matches',
    hostScope: 'femebal_same_organization',
    evidence: 'explicit_https_string_literal',
    probeAllowed: false,
    requiresPolicyReview: true,
  },
  {
    url: 'https://www.femebal.com/api/\tmatches',
    hostScope: 'femebal_same_organization',
    evidence: 'explicit_https_string_literal',
    probeAllowed: false,
    requiresPolicyReview: true,
  },
);
const forgedAmbiguousPolicy = classifyTournamentTrackerCandidatePolicy(forgedAmbiguous);
const encodedPolicyCandidate = forgedAmbiguousPolicy.candidates.at(-4);
const portPolicyCandidate = forgedAmbiguousPolicy.candidates.at(-3);
const backslashPolicyCandidate = forgedAmbiguousPolicy.candidates.at(-2);
const controlPolicyCandidate = forgedAmbiguousPolicy.candidates.at(-1);
assert.equal(encodedPolicyCandidate.state, 'rejected_on_policy_revalidation');
assert.equal(encodedPolicyCandidate.reason, 'percent_encoded_path_not_allowed');
assert.equal(encodedPolicyCandidate.anonymousGetReviewable, false);
assert.equal(portPolicyCandidate.state, 'rejected_on_policy_revalidation');
assert.equal(portPolicyCandidate.reason, 'nonstandard_https_port');
assert.equal(portPolicyCandidate.anonymousGetReviewable, false);
for (const candidate of [backslashPolicyCandidate, controlPolicyCandidate]) {
  assert.equal(candidate.state, 'rejected_on_policy_revalidation');
  assert.equal(candidate.reason, 'ambiguous_raw_url_characters');
  assert.equal(candidate.anonymousGetReviewable, false);
}

const policyBody = `
  const admin = "https://www.femebal.com/admin/matches";
  const mutating = "https://www.femebal.com/api/delete/match";
  const staticAsset = "https://www.femebal.com/tournament-tracker/static/js/runtime.js";
  const reviewable = "https://femebal.com/api/public/fixtures?season=2026";
`;
const policyExtraction = extractTournamentTrackerExplicitHttpsCandidates({
  body: policyBody,
  assetClassification: classifyBody(policyBody),
});
const classifiedPolicyBody = classifyTournamentTrackerCandidatePolicy(policyExtraction);
const byUrl = new Map(classifiedPolicyBody.candidates.map((item) => [item.url, item]));
assert.equal(byUrl.get('https://www.femebal.com/admin/matches').state, 'blocked_sensitive_or_mutating_path');
assert.equal(byUrl.get('https://www.femebal.com/api/delete/match').state, 'blocked_sensitive_or_mutating_path');
assert.equal(byUrl.get('https://www.femebal.com/tournament-tracker/static/js/runtime.js').state, 'static_resource_not_endpoint');
assert.equal(byUrl.get('https://femebal.com/api/public/fixtures?season=2026').state, 'femebal_public_get_reviewable');
assert.equal(classifiedPolicyBody.candidates.every((item) => item.probeAllowed === false), true);

const invalidPolicySource = classifyTournamentTrackerCandidatePolicy({
  ...extracted,
  sourceValidated: false,
});
assert.equal(invalidPolicySource.state, 'source_extraction_not_policy_eligible');
assert.deepEqual(invalidPolicySource.candidates, []);
assert.equal(invalidPolicySource.probeAllowed, false);

// Fail closed if a classification is accidentally paired with a different body,
// even when byte length is unchanged. SHA-256 binds the exact validated response.
const sameLengthDifferentBody = body.replace('season=2026', 'season=2027');
assert.equal(new TextEncoder().encode(sameLengthDifferentBody).byteLength, validatedAsset.bodyBytes);
const mismatchedBody = extractTournamentTrackerExplicitHttpsCandidates({
  body: sameLengthDifferentBody,
  assetClassification: validatedAsset,
});
assert.equal(mismatchedBody.state, 'source_not_validated');
assert.equal(mismatchedBody.sourceValidated, false);
assert.deepEqual(mismatchedBody.candidates, []);

const tamperedDigest = extractTournamentTrackerExplicitHttpsCandidates({
  body,
  assetClassification: { ...validatedAsset, bodySha256: '0'.repeat(64) },
});
assert.equal(tamperedDigest.state, 'source_not_validated');
assert.deepEqual(tamperedDigest.candidates, []);

console.log('TournamentTracker static endpoint candidate SAFE smoke OK');
