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
  sourceUrl: 'https://www.google.com/search?q=site%3Afemebal.com%2Ftournament-tracker%2FRUdVX3VkfFc%3D',
  resultUrl: observedPublicIndexedRoute,
};

assert.equal(canonicalizeIndexedTournamentTrackerRoute(observedPublicIndexedRoute), canonicalObservedRoute);
assert.equal(canonicalizeIndexedTournamentTrackerRoute('https://femebal.com:443/tournament-tracker/RUdVX3VkfFc='), canonicalObservedRoute);
// The official URL encodes only the trailing base64 padding; lowercase hex is equivalent.
assert.equal(canonicalizeIndexedTournamentTrackerRoute('https://www.femebal.com/tournament-tracker/RUdVX3VkfFc%3d'), canonicalObservedRoute);

for (const unsafe of [
  ' https://www.femebal.com/tournament-tracker/RUdVX3VkfFc= ',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc= extra',
  'http://www.femebal.com/tournament-tracker/RUdVX3VkfFc=',
  'https://evil.example/tournament-tracker/RUdVX3VkfFc=',
  'https://user:pass@www.femebal.com/tournament-tracker/RUdVX3VkfFc=',
  'https://www.femebal.com:444/tournament-tracker/RUdVX3VkfFc=',
  'https://www.femebal.com/tournament-tracker/',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=/extra',
  'https://www.femebal.com/tournament-tracker/../secret',
  'https://www.femebal.com/tournament-tracker/./token',
  'https://www.femebal.com/tournament-tracker/%2e%2e/secret',
  'https://www.femebal.com/tournament-tracker/%2e/token',
  'https://www.femebal.com/tournament-tracker/a/../token',
  'https://www.femebal.com/tournament-tracker/a/./token',
  'https://www.femebal.com/tournament-tracker/..%2Fsecret',
  'https://www.femebal.com/tournament-tracker/token%5Cescape',
  'https://www.femebal.com/tournament-tracker/token%252Fescape',
  'https://www.femebal.com/tournament-tracker/token.with.dot',
  // Percent-encoded token characters must not create alternate raw spellings.
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc%41',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc%2D',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc%5F',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc%253D',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=?clubId=0',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=#x',
  // Empty delimiters must also be rejected before URL normalization can erase them.
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=?',
  'https://www.femebal.com/tournament-tracker/RUdVX3VkfFc=#',
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
  // Match the shared official URL policy: compound authentication names must fail closed.
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&authValue=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&authenticationMethod=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&authorizationToken=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&api%4BeyValue=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&authorizationValue=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&cookieValue=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&sessionValue=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&passwordReset=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&signature=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&authorToken=redacted`, resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: 'https://www.femebal.com/tournament-tracker/QUJDRA==', sourceUrl: publicEvidence.sourceUrl, resultUrl: observedPublicIndexedRoute },
  { kind: 'manual_guess', observedUrl: observedPublicIndexedRoute, sourceUrl: publicEvidence.sourceUrl },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'http://www.google.com/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://user:pass@www.google.com/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com:444/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.bing.com:444/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal+tournament-tracker#fragment' },
  // Empty raw fragments are invisible in URL.hash after WHATWG normalization.
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal+tournament-tracker#' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://search.example/search?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/maps?q=femebal+tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.bing.com/search?q=tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=site%3Afemebal.com%2Ftournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.bing.com/search?q=site%3Afemebal.com%2Ftournament-tracker%2FOTROTOKEN%3D' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: publicEvidence.sourceUrl },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=site%3Afemebal.com%2Ftournament-tracker%2FRUdVX3VkfFc%3Dextra', resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=site%3Aevilfemebal.com%2Ftournament-tracker%2FRUdVX3VkfFc%3D', resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: publicEvidence.sourceUrl, resultUrl: 'https://www.femebal.com/tournament-tracker/OTROTOKEN=' },
  // The opaque route token is case-sensitive: a lowercase path in the search query must not attest the mixed-case target, even if resultUrl claims the target.
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=site%3Afemebal.com%2Ftournament-tracker%2Frudvx3vkffc%3D', resultUrl: observedPublicIndexedRoute },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal tournament-tracker' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal+tournament-tracker&accessToken=redacted' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.bing.com/search?q=femebal+tournament-tracker&session_id=redacted' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.google.com/search?q=femebal+tournament-tracker' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://evil.example/fixture-publico' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com:444/fixture-publico' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico?api_key=redacted' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico', linkedUrl: 'https://www.femebal.com/tournament-tracker/OTROTOKEN=' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico?credential=redacted' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico?' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico#' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: observedPublicIndexedRoute },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/tournament-tracker/OTROTOKEN=' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/%74ournament-tracker/OTROTOKEN=' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/%2574ournament-tracker/OTROTOKEN=' },
  { kind: 'explicit_public_link', observedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-%ZZpublico' },
  { kind: 'public_index', observedUrl: observedPublicIndexedRoute, sourceUrl: `${publicEvidence.sourceUrl}&q=site%3Afemebal.com%2Ftournament-tracker%2FOTROTOKEN%3D`, resultUrl: observedPublicIndexedRoute },
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
assert.equal(reviewed.evidence.resultUrl, canonicalObservedRoute);

const bingEvidence = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence: { kind: 'public_index', observedUrl: canonicalObservedRoute, sourceUrl: 'https://www.bing.com/search?q=site%3Afemebal.com%2Ftournament-tracker%2FRUdVX3VkfFc%3D', resultUrl: canonicalObservedRoute } });
assert.equal(bingEvidence.state, 'reviewed_anonymous_get_only');

const explicitLinkEvidence = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence: { kind: 'explicit_public_link', observedUrl: canonicalObservedRoute, linkedUrl: observedPublicIndexedRoute, sourceUrl: 'https://www.femebal.com/fixture-publico?season=2026' } });
assert.equal(explicitLinkEvidence.state, 'reviewed_anonymous_get_only');
assert.equal(explicitLinkEvidence.evidence.linkedUrl, canonicalObservedRoute);

const realLhcObservedRoute = 'https://www.femebal.com/tournament-tracker/RUdVX3VheVA%3D';
const realLhcCanonicalRoute = 'https://www.femebal.com/tournament-tracker/RUdVX3VheVA=';
const realLhcEvidence = {
  kind: 'explicit_public_link',
  observedUrl: realLhcObservedRoute,
  linkedUrl: realLhcObservedRoute,
  sourceUrl: 'https://femebal.com/fixtures-disponibles-para-la-liga-hipotecario-seguros-y-la-liga-plata/',
};
const realLhcReviewed = buildReviewedIndexedTournamentTrackerGet(realLhcObservedRoute, { publicEvidence: realLhcEvidence });
assert.equal(realLhcReviewed.state, 'reviewed_anonymous_get_only');
assert.equal(realLhcReviewed.probe.url, realLhcCanonicalRoute);
assert.equal(realLhcReviewed.probe.method, 'GET');
assert.equal(realLhcReviewed.probe.auth, false);
assert.equal(realLhcReviewed.probe.writes, false);
assert.equal(realLhcReviewed.automaticProbeAllowed, false);
assert.equal(realLhcReviewed.evidence.kind, 'explicit_public_link');
assert.equal(realLhcReviewed.evidence.observedUrl, realLhcCanonicalRoute);
assert.equal(realLhcReviewed.evidence.sourceUrl, realLhcEvidence.sourceUrl);

for (const name of ['author', 'authorId']) {
  const authorEvidence = {
    kind: 'explicit_public_link',
    observedUrl: observedPublicIndexedRoute,
    linkedUrl: observedPublicIndexedRoute,
    sourceUrl: `https://www.femebal.com/fixture?${name}=club`,
  };
  const acceptedAuthorFilter = buildReviewedIndexedTournamentTrackerGet(observedPublicIndexedRoute, { publicEvidence: authorEvidence });
  assert.equal(acceptedAuthorFilter.state, 'reviewed_anonymous_get_only');
  assert.equal(acceptedAuthorFilter.probe.auth, false);
  assert.equal(acceptedAuthorFilter.probe.writes, false);
}

const invalidReviewed = buildReviewedIndexedTournamentTrackerGet('https://evil.example/tournament-tracker/RUdVX3VkfFc=', { publicEvidence });
assert.equal(invalidReviewed.state, 'probe_not_authorized');
assert.equal(invalidReviewed.probe, null);

console.log('TournamentTracker indexed route SAFE smoke OK');
