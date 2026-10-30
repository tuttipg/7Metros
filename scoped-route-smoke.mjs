import assert from 'node:assert/strict';
import { resolveScopedRouteContext } from './scoped-route-core.mjs';
import { readRouteParam } from './route-id-core.mjs';

const oneContext = [
  { teamId: 10, contextKey: 'Mayores|LHC|M' },
  { teamId: 11, contextKey: 'Mayores|LHC|M' }
];

assert.deepEqual(
  resolveScopedRouteContext({ entityId: 7, currentPresent: true, memberships: oneContext }),
  { status: 'current', entityId: 7 }
);

assert.deepEqual(
  resolveScopedRouteContext({ entityId: 7, currentPresent: false, memberships: oneContext }),
  { status: 'team', entityId: 7, teamId: 10, contextKey: 'Mayores|LHC|M' }
);

assert.deepEqual(
  resolveScopedRouteContext({ entityId: 7, requestedTeamId: 11, currentPresent: true, memberships: oneContext }),
  { status: 'team', entityId: 7, teamId: 11, contextKey: 'Mayores|LHC|M' }
);

assert.equal(
  resolveScopedRouteContext({ entityId: 7, requestedTeamId: 99, currentPresent: true, memberships: oneContext }).status,
  'invalid-team'
);

const multiContext = [
  { teamId: 20, contextKey: 'Mayores|LHC|M' },
  { teamId: 21, contextKey: 'Cadetes|A|M' }
];
assert.equal(
  resolveScopedRouteContext({ entityId: 7, currentPresent: false, memberships: multiContext }).status,
  'ambiguous'
);

assert.equal(resolveScopedRouteContext({ entityId: 0, memberships: oneContext }).status, 'invalid');
assert.equal(resolveScopedRouteContext({ entityId: 7, memberships: [] }).status, 'missing');

for (const bad of ['', '0', '010', '10e0', '10.0', '-1', 'oops', '9007199254740992']) {
  assert.equal(resolveScopedRouteContext({
    entityId: 7, requestedTeamId: bad, currentPresent: true, memberships: oneContext
  }).status, 'invalid-team', `team=${bad} must not fall back to current context`);
}
for (const bad of ['', '0', '07', '7e0', '7.0', '9007199254740992']) {
  assert.equal(resolveScopedRouteContext({ entityId: bad, memberships: oneContext }).status, 'invalid');
}
assert.equal(readRouteParam(new URLSearchParams('id=7'), 'team'), null);
assert.equal(readRouteParam(new URLSearchParams('team=10'), 'team'), '10');
assert.equal(readRouteParam(new URLSearchParams('team=10&team=11'), 'team'), '');
assert.equal(readRouteParam(new URLSearchParams('id=7&id=7'), 'id'), '');
console.log('scoped-route-smoke: ok');
