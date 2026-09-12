import assert from 'node:assert/strict';
import { resolveScopedRouteContext } from './scoped-route-core.mjs';

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

console.log('scoped-route-smoke: ok');
