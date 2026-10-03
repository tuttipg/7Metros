import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractTournamentTrackerStaticRelativePaths } from './tournamenttracker-static-relative-path-core.mjs';

function classification(body) {
  return {
    state: 'public_static_javascript',
    analyzableStaticJavascript: true,
    analysisMode: 'static_text_only',
    executionAllowed: false,
    bodyBytes: new TextEncoder().encode(body).byteLength,
    bodySha256: createHash('sha256').update(body, 'utf8').digest('hex'),
  };
}

const body = [
  `const a='/get-context';`,
  `const b='/torneos/775';`,
  `const c='/auth/login';`,
  `const d='/static/main.js';`,
  `const e='/torneos/' + id;`,
  'const f=`/torneos/${id}`;',
  `const g='//external.example/path';`,
  `const h='/torneos/775?token=nope';`,
].join('\n');

const result = extractTournamentTrackerStaticRelativePaths({ body, assetClassification: classification(body) });
assert.equal(result.safe, true);
assert.equal(result.dry_run, true);
assert.equal(result.sourceValidated, true);
assert.equal(result.probeAllowed, false);
assert.equal(result.executionAllowed, false);
assert.equal(result.constraints.hostResolutionAllowed, false);
assert.equal(result.constraints.automaticProbingAllowed, false);
assert.equal(result.constraints.writesAllowed, false);
assert.equal(result.constraints.authAllowed, false);
assert.deepEqual(result.candidates.map((item) => item.path), ['/get-context', '/torneos/775']);
assert.ok(result.candidates.every((item) => item.hostResolved === false && item.probeAllowed === false));

const forged = classification(body);
forged.bodySha256 = '0'.repeat(64);
const rejectedSource = extractTournamentTrackerStaticRelativePaths({ body, assetClassification: forged });
assert.equal(rejectedSource.sourceValidated, false);
assert.deepEqual(rejectedSource.candidates, []);

console.log('TournamentTracker SAFE relative-path smoke: OK');
