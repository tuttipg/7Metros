import assert from 'node:assert/strict';
import {
  buildReviewedIndexedTournamentTrackerGet,
  canonicalizeIndexedTournamentTrackerRoute,
  classifyIndexedTournamentTrackerRoute,
} from './tournamenttracker-indexed-route-core.mjs';

const observedPublicIndexedRoute = 'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc%3D';
assert.equal(
  canonicalizeIndexedTournamentTrackerRoute(observedPublicIndexedRoute),
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=',
);
assert.equal(
  canonicalizeIndexedTournamentTrackerRoute('https://femebal.com:443/tournament-tracker/RUdVX3VkfFc='),
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=',
);

for (const unsafe of [
  'http://www.femebal.com/tournament-tracker/RUdVX3VkfFc=',
  'https://evil.example/tournament-tracker/RUdVX3VkfFc=',
  'https://user:pass@www.femebal.com/tournament-tracker/RUdVX3VkfFc=',
  'https://www.femebal.com/tournament-tracker/',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=/extra',
  'https://www.femebal.com/tournament-tracker/..%2Fsecret',
  'https://www.femebal.com/tournament-tracker/token%5Cescape',
  'https://www.femebal.com/tournament-tracker/token%252Fescape',
  'https://www.femebal.com/tournament-tracker/token.with.dot',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=?clubId=0',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=#x',
]) {
  assert.throws(() => canonicalizeIndexedTournamentTrackerRoute(unsafe));
}

const classified = classifyIndexedTournamentTrackerRoute(observedPublicIndexedRoute);
assert.equal(classified.state, 'public_indexed_route_reviewable');
assert.equal(classified.methodIfReviewed, 'GET');
assert.equal(classified.authAllowed, false);
assert.equal(classified.writesAllowed, false);
assert.equal(classified.automaticProbeAllowed, false);
assert.equal(classified.sourceRequirement, 'public_index_or_explicit_public_link');

const noEvidence = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute);
assert.equal(noEvidence.state, 'probe_not_authorized');
assert.equal(noEvidence.probe, null);
assert.equal(noEvidence.automaticProbeAllowed, false);

const reviewed = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence: true });
assert.equal(reviewed.state, 'reviewed_anonymous_get_only');
assert.equal(reviewed.probe.method, 'GET');
assert.equal(reviewed.probe.url, 'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=');
assert.equal(reviewed.probe.auth, false);
assert.equal(reviewed.probe.writes, false);
assert.equal('Authorization' in reviewed.probe.headers, false);
assert.equal('Cookie' in reviewed.probe.headers, false);
assert.equal(reviewed.automaticProbeAllowed, false);

const invalidReviewed = buildReviewedIndexedTournamentTrackerGet(
  'https://evil.example/tournament-tracker/RUdVX3VkfFc=',
  { publicEvidence: true },
);
assert.equal(invalidReviewed.state, 'probe_not_authorized');
assert.equal(invalidReviewed.probe, null);

console.log('TournamentTracker indexed route SAFE smoke OK');
