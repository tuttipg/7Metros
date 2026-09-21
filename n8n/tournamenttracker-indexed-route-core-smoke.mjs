import assert from 'node:assert/strict';
import {
  buildReviewedIndexedTournamentTrackerGet,
  canonicalizeIndexedTournamentTrackerRoute,
  classifyIndexedTournamentTrackerRoute,
} from './tournamenttracker-indexed-route-core.mjs';

const observedPublicIndexedRoute = 'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc%3D';
const canonicalObservedRoute = 'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=';
const publicEvidence = {
  kind: 'public_index',
  observedUrl: observedPublicIndexedRoute,
  sourceUrl: 'https://www.google.com/search?q=site%3Afemebal.com%2Ftournament-tracker',
};

assert.equal(canonicalizeIndexedTournamentTrackerRoute(observedPublicIndexedRoute), canonicalObservedRoute);
assert.equal(canonicalizeIndexedTournamentTrackerRoute('https://femebal.com:443/tournament-tracker/RUdVX3VkfFc='), canonicalObservedRoute);

for (const unsafe of [
  'http://www.femebal.com/tournament-tracker/RUdVX3VkfFc=',
  'https://evil.example/tournament-tracker/RUdVX3VkfFc=',
  'https://user:pass@www.femebal.com/tournament-tracker/RUdVX3VkfFc=',
  'https://www.femebal.com:444/tournament-tracker/RUdVX3VkfFc=',
  'https://www.femebal.com/tournament-tracker/',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=/extra',
  'https://www.femebal.com/tournament-tracker/..%2Fsecret',
  'https://www.femebal.com/tournament-tracker/token%5Cescape',
  'https://www.femebal.com/tournament-tracker/token%252Fescape',
  'https://www.femebal.com/tournament-tracker/token.with.dot',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=?clubId=0',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=#x',
]) assert.throws(() => canonicalizeIndexedTournamentTrackerRoute(unsafe));

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

const booleanEvidence = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence: true });
assert.equal(booleanEvidence.state, 'probe_not_authorized');
assert.equal(booleanEvidence.probe, null);

for (const badEvidence of [
  { kind: 'public_index', observedUrl: 'https://www.femebal.com/tournament-tracker/QUJDRA==', sourceUrl: publicEvidence.sourceUrl },
  { kind: 'manual_guess', observedUrl: observedPublicIndexedRoute, sourceUrl: publicEvidence.sourceUrl },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'http://www.google.com/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://user:pass@www.google.com/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com:444/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.bing.com:444/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal+tournament-tracker#fragment' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://search.example/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/maps?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.bing.com/search?q=tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal+tournament-tracker&accessToken=redacted' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.bing.com/search?q=femebal+tournament-tracker&session_id=redacted' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal+tournament-tracker' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://evil.example/fixture-publico' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com:444/fixture-publico' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico?api_key=redacted' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico?credential=redacted' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: observedPublicIndexedRoute },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/tournament-tracker/OTROTOKEN=' },
]) {
  const rejected = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence: badEvidence });
  assert.equal(rejected.state, 'probe_not_authorized');
  assert.equal(rejected.probe, null);
}

const reviewed = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence });
assert.equal(reviewed.state, 'reviewed_anonymous_get_only');
assert.equal(reviewed.probe.method, 'GET');
assert.equal(reviewed.probe.url, canonicalObservedRoute);
assert.equal(reviewed.probe.auth, false);
assert.equal(reviewed.probe.writes, false);
assert.equal('Authorization' in reviewed.probe.headers, false);
assert.equal('Cookie' in reviewed.probe.headers, false);
assert.equal(reviewed.automaticProbeAllowed, false);
assert.equal(reviewed.evidence.kind, 'public_index');
assert.equal(reviewed.evidence.observedUrl, canonicalObservedRoute);
assert.equal(reviewed.evidence.sourceUrl, publicEvidence.sourceUrl);

const bingEvidence = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence: { kind: 'public_index', observedUrl: canonicalObservedRoute, sourceUrl: 'https://www.bing.com/search?q=site%3Afemebal.com%2Ftournament-tracker' } });
assert.equal(bingEvidence.state, 'reviewed_anonymous_get_only');

const explicitLinkEvidence = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence: { kind: 'explicit_public_link', observedUrl: canonicalObservedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico?season=2026' } });
assert.equal(explicitLinkEvidence.state, 'reviewed_anonymous_get_only');

const invalidReviewed = buildReviewedIndexedTournamentTrackerGet('https://evil.example/tournament-tracker/RUdVX3VkfFc=', { publicEvidence });
assert.equal(invalidReviewed.state, 'probe_not_authorized');
assert.equal(invalidReviewed.probe, null);

console.log('TournamentTracker indexed route SAFE smoke OK');
