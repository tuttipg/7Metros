import assert from 'node:assert/strict';
import {
  COMMUNITY_API_BASE,
  COMMUNITY_APP_VARIANT,
  buildCommunityProbePlan,
  classifyCommunityResponse,
  communityHeaders,
  summarizeCommunityDiscovery
} from './community-api-core.mjs';

{
  const headers = communityHeaders();
  assert.equal(COMMUNITY_API_BASE, 'https://api.cam.larrysport.tecdata.net');
  assert.equal(COMMUNITY_APP_VARIANT, 'cah');
  assert.equal(headers['X-App-Variant'], 'cah');
  assert.equal(headers.Accept, 'application/json');
}

{
  const plan = buildCommunityProbePlan();
  assert(plan.some(item => item.path === '/teams/categories'));
  assert(plan.some(item => item.path === '/news/list'));
  assert(plan.some(item => item.path.startsWith('/matches?')));
  assert(plan.every(item => item.url.startsWith(COMMUNITY_API_BASE)));
}

assert.equal(classifyCommunityResponse({
  statusCode: 200,
  body: '[{"id":"100","name":"Mayores"}]'
}).state, 'public_json');

assert.equal(classifyCommunityResponse({
  statusCode: 401,
  body: '{"error":"Unauthorized","message":"Missing authorization header"}'
}).state, 'auth_required');

assert.equal(classifyCommunityResponse({
  statusCode: 404,
  body: '<pre>Cannot GET /top-scorers</pre>'
}).state, 'not_found');

assert.equal(classifyCommunityResponse({
  statusCode: 200,
  body: '<html>ok</html>'
}).state, 'public_non_json');

{
  const summary = summarizeCommunityDiscovery([
    { key: 'team_categories', path: '/teams/categories', statusCode: 200, body: '[{"id":"100","name":"Mayores"}]' },
    { key: 'news', path: '/news/list', statusCode: 200, body: '[{"id":"n1","title":"Beneficio"}]' },
    { key: 'matches', path: '/matches?offset=0', statusCode: 401, body: '{"error":"Unauthorized","message":"Missing authorization header"}' },
    { key: 'top_scorers', path: '/top-scorers', statusCode: 404, body: 'Cannot GET /top-scorers' }
  ]);

  assert.equal(summary.nextStep, 'reverse_engineer_app_auth_flow');
  assert.equal(summary.constraints.publicEndpointDoesNotImplyMatchesArePublic, true);
  assert.equal(summary.constraints.firebaseAuthValidated, false);
  assert.deepEqual(summary.authRequired, ['/matches?offset=0']);
  assert.deepEqual(summary.notFound, ['/top-scorers']);
}

// Una respuesta externa de configuración NO valida Firebase Auth ni cambia el próximo paso.
{
  const summary = summarizeCommunityDiscovery([
    { key: 'matches', path: '/matches', statusCode: 401, body: '{"error":"Unauthorized","message":"Missing authorization header"}' },
    { key: 'auth_probe', path: '/external-auth', statusCode: 400, body: '{"message":"CONFIGURATION_NOT_FOUND"}' }
  ]);
  assert.equal(summary.nextStep, 'reverse_engineer_app_auth_flow');
  assert.equal(summary.constraints.firebaseAuthValidated, false);
}

console.log('✓ community-api-core: rutas públicas/protegidas y fail-closed de auth OK');
