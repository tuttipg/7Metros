import assert from 'node:assert/strict';
import { classifyTournamentTrackerStaticAssetResponse } from './tournamenttracker-public-core.mjs';
import { extractTournamentTrackerExplicitHttpsCandidates } from './tournamenttracker-static-endpoint-core.mjs';

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
  const concatenated = "https://www.femebal.com/api/" + matchId;
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

assert.deepEqual(extracted.candidates, [
  {
    url: 'https://public.example.org/v1/fixtures',
    hostScope: 'external_untrusted',
    evidence: 'explicit_https_string_literal',
    probeAllowed: false,
    requiresPolicyReview: true,
  },
  {
    url: 'https://www.femebal.com/api/',
    hostScope: 'femebal_same_organization',
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
assert.equal(extracted.rejectedCount, 5);
assert.equal(extracted.candidates.some((item) => /secret|pass|token=/i.test(item.url)), false);

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
