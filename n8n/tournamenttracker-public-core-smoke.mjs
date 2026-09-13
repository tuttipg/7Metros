import assert from 'node:assert/strict';
import {
  FEMEBAL_TOURNAMENTTRACKER_URL,
  buildTournamentTrackerPublicProbePlan,
  buildTournamentTrackerStaticAssetProbePlan,
  canonicalizeFemebalTournamentTrackerUrl,
  canonicalizeTournamentTrackerStaticAssetUrl,
  classifyTournamentTrackerPublicResponse,
  extractTournamentTrackerStaticAssetUrls,
  summarizeTournamentTrackerPublicDiscovery,
} from './tournamenttracker-public-core.mjs';

assert.equal(
  canonicalizeFemebalTournamentTrackerUrl('https://femebal.com/tournament-tracker?noAdv=0'),
  FEMEBAL_TOURNAMENTTRACKER_URL,
);
assert.equal(
  canonicalizeFemebalTournamentTrackerUrl('https://www.femebal.com:443/tournament-tracker/?noAdv=1'),
  'https://www.femebal.com/tournament-tracker/?noAdv=1',
);

for (const unsafe of [
  'http://www.femebal.com/tournament-tracker/?noAdv=0',
  'https://evil.example/tournament-tracker/?noAdv=0',
  'https://user:pass@www.femebal.com/tournament-tracker/?noAdv=0',
  'https://www.femebal.com/tournament-tracker/?token=secret',
  'https://www.femebal.com/tournament-tracker/?noAdv=2',
  'https://www.femebal.com/tournament-tracker/?noAdv=0&noAdv=1',
  'https://www.femebal.com/tournament-tracker/?noAdv=0&noAdv=0',
  'https://www.femebal.com/tournament-tracker/#x',
  'https://www.femebal.com/otra-ruta/?noAdv=0',
]) {
  assert.throws(() => canonicalizeFemebalTournamentTrackerUrl(unsafe));
}

assert.equal(
  canonicalizeTournamentTrackerStaticAssetUrl('./static/js/main.abc123.js'),
  'https://www.femebal.com/tournament-tracker/static/js/main.abc123.js',
);
assert.equal(
  canonicalizeTournamentTrackerStaticAssetUrl('https://femebal.com/tournament-tracker/static/js/chunk.mjs'),
  'https://www.femebal.com/tournament-tracker/static/js/chunk.mjs',
);
for (const unsafeAsset of [
  'http://www.femebal.com/tournament-tracker/static/js/main.js',
  'https://evil.example/tournament-tracker/static/js/main.js',
  'https://www.femebal.com/static/js/main.js',
  'https://www.femebal.com/tournament-tracker/static/js/main.js?token=x',
  'https://www.femebal.com/tournament-tracker/static/js/main.js#x',
  'https://www.femebal.com/tournament-tracker/static/css/main.css',
  'https://www.femebal.com/tournament-tracker/%2f..%2fstatic%2fjs%2fmain.js',
  'https://www.femebal.com/tournament-tracker/static%2fjs%2fmain.js',
  'https://www.femebal.com/tournament-tracker/static%5cjs%5cmain.js',
]) {
  assert.throws(() => canonicalizeTournamentTrackerStaticAssetUrl(unsafeAsset));
}

const shellWithAssets = `
<!doctype html><html><head>
<link rel="preload" href="/tournament-tracker/static/js/runtime.1.js" as="script">
<link href="./static/js/vendor.2.mjs" rel="modulepreload">
</head><body><div id="root"></div>
<script src="./static/js/main.3.js"></script>
<script src="https://evil.example/tournament-tracker/static/js/evil.js"></script>
<script src="/static/js/outside.js"></script>
<script src="./static/js/main.3.js"></script>
</body></html>`;
const extractedAssets = extractTournamentTrackerStaticAssetUrls(shellWithAssets);
assert.deepEqual(extractedAssets.assets, [
  'https://www.femebal.com/tournament-tracker/static/js/main.3.js',
  'https://www.femebal.com/tournament-tracker/static/js/runtime.1.js',
  'https://www.femebal.com/tournament-tracker/static/js/vendor.2.mjs',
]);
assert.equal(extractedAssets.rejected.length, 2);

const staticPlan = buildTournamentTrackerStaticAssetProbePlan(shellWithAssets);
assert.equal(staticPlan.safe, true);
assert.equal(staticPlan.dry_run, true);
assert.equal(staticPlan.write_enabled, false);
assert.equal(staticPlan.auth_used, false);
assert.equal(staticPlan.probes.length, 3);
assert.equal(staticPlan.constraints.executableEvaluationAllowed, false);
for (const probe of staticPlan.probes) {
  assert.equal(probe.method, 'GET');
  assert.equal(probe.auth, false);
  assert.equal(probe.writes, false);
  assert.equal('Authorization' in probe.headers, false);
  assert.equal('Cookie' in probe.headers, false);
}

const plan = buildTournamentTrackerPublicProbePlan();
assert.equal(plan.length, 1);
assert.equal(plan[0].method, 'GET');
assert.equal(plan[0].auth, false);
assert.equal(plan[0].writes, false);
assert.equal('Authorization' in plan[0].headers, false);
assert.equal('Cookie' in plan[0].headers, false);

const publicShell = classifyTournamentTrackerPublicResponse({
  statusCode: 200,
  body: '<html><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>',
});
assert.equal(publicShell.state, 'public_spa_shell');
assert.equal(publicShell.publicSpaShell, true);

const protectedSurface = summarizeTournamentTrackerPublicDiscovery({
  statusCode: 401,
  body: 'Unauthorized',
});
assert.equal(protectedSurface.next_step, 'stop_protected_surface');
assert.equal(protectedSurface.auth_used, false);
assert.equal(protectedSurface.write_enabled, false);
assert.equal(protectedSurface.constraints.authorizationAllowed, false);

const externalRedirect = classifyTournamentTrackerPublicResponse({
  statusCode: 200,
  body: '<div id="root"></div>',
  finalUrl: 'https://example.com/tournament-tracker/',
});
assert.equal(externalRedirect.state, 'unsafe_redirect_or_url');

console.log('TournamentTracker public SAFE smoke OK');
