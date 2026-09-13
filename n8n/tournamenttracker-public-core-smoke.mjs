import assert from 'node:assert/strict';
import {
  FEMEBAL_TOURNAMENTTRACKER_URL,
  buildTournamentTrackerPublicProbePlan,
  canonicalizeFemebalTournamentTrackerUrl,
  classifyTournamentTrackerPublicResponse,
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
  'https://www.femebal.com/tournament-tracker/#x',
  'https://www.femebal.com/otra-ruta/?noAdv=0',
]) {
  assert.throws(() => canonicalizeFemebalTournamentTrackerUrl(unsafe));
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
