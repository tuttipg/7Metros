import assert from 'node:assert/strict';
import {
  FEMEBAL_TOURNAMENTTRACKER_URL,
  TOURNAMENTTRACKER_MAX_STATIC_ASSET_BYTES,
  buildTournamentTrackerPublicProbePlan,
  buildTournamentTrackerStaticAssetProbePlan,
  canonicalizeFemebalTournamentTrackerUrl,
  canonicalizeTournamentTrackerStaticAssetUrl,
  classifyTournamentTrackerPublicResponse,
  classifyTournamentTrackerStaticAssetResponse,
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
<link rel="preload stylesheet" href="./static/js/not-script-preload.js" as="style">
<link rel="preload" href="./static/js/not-script-missing-as.js">
<link rel="preload" href="./static/js/not-script-image.js" as="image">
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
assert.equal(extractedAssets.assets.some((url) => url.includes('not-script')), false);

const scriptPreloadAttributeOrder = extractTournamentTrackerStaticAssetUrls(`
<link as='script' href='./static/js/ordered.js' rel='preload'>
<link href='./static/js/module.js' crossorigin='anonymous' rel='modulepreload'>
`);
assert.deepEqual(scriptPreloadAttributeOrder.assets, [
  'https://www.femebal.com/tournament-tracker/static/js/module.js',
  'https://www.femebal.com/tournament-tracker/static/js/ordered.js',
]);

const ambiguousAttributes = extractTournamentTrackerStaticAssetUrls(`
<script src='./static/js/first.js' src='./static/js/second.js'></script>
<link rel='preload' as='script' href='./static/js/first-link.js' href='./static/js/second-link.js'>
<link rel='preload' rel='modulepreload' as='script' href='./static/js/duplicate-rel.js'>
<link rel='preload' as='script' as='style' href='./static/js/duplicate-as.js'>
`);
assert.deepEqual(ambiguousAttributes.assets, []);
assert.equal(ambiguousAttributes.rejected.length, 4);
assert.match(ambiguousAttributes.rejected[0].reason, /src duplicado/i);
assert.match(ambiguousAttributes.rejected[1].reason, /href duplicado/i);
assert.match(ambiguousAttributes.rejected[2].reason, /rel duplicado/i);
assert.match(ambiguousAttributes.rejected[3].reason, /as duplicado/i);

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

const safeAssetUrl = 'https://www.femebal.com/tournament-tracker/static/js/main.3.js';
const analyzableAsset = classifyTournamentTrackerStaticAssetResponse({
  statusCode: 200,
  body: 'const api = "/public/example";',
  contentType: 'application/javascript; charset=utf-8',
  finalUrl: safeAssetUrl,
});
assert.equal(analyzableAsset.state, 'public_static_javascript');
assert.equal(analyzableAsset.analyzableStaticJavascript, true);
assert.equal(analyzableAsset.executionAllowed, false);
assert.equal(analyzableAsset.analysisMode, 'static_text_only');
assert.equal(analyzableAsset.contentType, 'application/javascript');
assert.ok(analyzableAsset.bodyBytes > 0);
assert.equal(analyzableAsset.maxBytes, TOURNAMENTTRACKER_MAX_STATIC_ASSET_BYTES);

const textJavascriptAsset = classifyTournamentTrackerStaticAssetResponse({
  statusCode: 200,
  body: 'export default 1;',
  contentType: 'text/javascript',
  finalUrl: safeAssetUrl,
});
assert.equal(textJavascriptAsset.analyzableStaticJavascript, true);

for (const [expectedState, response] of [
  ['unsafe_redirect_or_url', {
    statusCode: 200,
    body: 'alert(1)',
    contentType: 'application/javascript',
    finalUrl: 'https://evil.example/tournament-tracker/static/js/main.js',
  }],
  ['auth_required', {
    statusCode: 403,
    body: 'Forbidden',
    contentType: 'text/plain',
    finalUrl: safeAssetUrl,
  }],
  ['not_found', {
    statusCode: 404,
    body: 'Not found',
    contentType: 'text/plain',
    finalUrl: safeAssetUrl,
  }],
  ['transport_or_server_error', {
    statusCode: 500,
    body: 'Error',
    contentType: 'text/plain',
    finalUrl: safeAssetUrl,
  }],
  ['empty_body', {
    statusCode: 200,
    body: '',
    contentType: 'application/javascript',
    finalUrl: safeAssetUrl,
  }],
  ['unexpected_content_type', {
    statusCode: 200,
    body: '<html>not js</html>',
    contentType: 'text/html; charset=utf-8',
    finalUrl: safeAssetUrl,
  }],
  ['body_too_large', {
    statusCode: 200,
    body: '12345',
    contentType: 'application/javascript',
    finalUrl: safeAssetUrl,
    maxBytes: 4,
  }],
]) {
  const classified = classifyTournamentTrackerStaticAssetResponse(response);
  assert.equal(classified.state, expectedState);
  assert.equal(classified.analyzableStaticJavascript, false);
}

const multibyteLimit = classifyTournamentTrackerStaticAssetResponse({
  statusCode: 200,
  body: 'áá',
  contentType: 'application/javascript',
  finalUrl: safeAssetUrl,
  maxBytes: 3,
});
assert.equal(multibyteLimit.state, 'body_too_large');
assert.equal(multibyteLimit.bodyBytes, 4);

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
