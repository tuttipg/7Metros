import assert from 'node:assert/strict';
import { extractTournamentTrackerExplicitHttpsCandidates } from './tournamenttracker-static-endpoint-core.mjs';

const validatedAsset = {
  analyzableStaticJavascript: true,
  analysisMode: 'static_text_only',
  executionAllowed: false,
};

const unvalidated = extractTournamentTrackerExplicitHttpsCandidates({
  body: 'const x = "https://www.femebal.com/api/matches";',
  assetClassification: { analyzableStaticJavascript: false },
});
assert.equal(unvalidated.state, 'source_not_validated');
assert.equal(unvalidated.sourceValidated, false);
assert.deepEqual(unvalidated.candidates, []);
assert.equal(unvalidated.probeAllowed, false);

const extracted = extractTournamentTrackerExplicitHttpsCandidates({
  body: `
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
  `,
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
assert.equal(extracted.rejectedCount, 4);
assert.equal(extracted.candidates.some((item) => /secret|pass|token=/i.test(item.url)), false);

console.log('TournamentTracker static endpoint candidate SAFE smoke OK');
