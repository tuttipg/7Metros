import assert from 'node:assert/strict';
import { resolvePlayerRouteContext } from './player-route-core.mjs';

assert.deepEqual(
  resolvePlayerRouteContext({ playerId: 10, visibleMembershipTeamIds: [101], membershipTeamIds: [101] }),
  { status: 'current', playerId: 10, teamId: 101 },
  'Un jugador ya visible en un único equipo del filtro actual debe conservar ese contexto'
);

assert.deepEqual(
  resolvePlayerRouteContext({ playerId: 10, visibleMembershipTeamIds: [], membershipTeamIds: [101] }),
  { status: 'team', playerId: 10, teamId: 101 },
  'Un enlace desde Inicio debe poder resolver una única pertenencia aunque los filtros guardados sean otros'
);

assert.deepEqual(
  resolvePlayerRouteContext({ playerId: 10, requestedTeamId: 202, visibleMembershipTeamIds: [101, 202], membershipTeamIds: [101, 202] }),
  { status: 'team', playerId: 10, teamId: 202 },
  'El team explícito debe resolver jugadores con múltiples planteles sin mezclar estadísticas'
);

const ambiguous = resolvePlayerRouteContext({ playerId: 10, membershipTeamIds: [101, 202] });
assert.equal(ambiguous.status, 'ambiguous');
assert.deepEqual(ambiguous.choices, [101, 202]);

const visibleAmbiguous = resolvePlayerRouteContext({
  playerId: 10,
  visibleMembershipTeamIds: [101, 202],
  membershipTeamIds: [101, 202]
});
assert.equal(visibleAmbiguous.status, 'ambiguous');
assert.deepEqual(visibleAmbiguous.choices, [101, 202]);

assert.deepEqual(
  resolvePlayerRouteContext({ playerId: 10, visibleMembershipTeamIds: [202], membershipTeamIds: [101, 202] }),
  { status: 'current', playerId: 10, teamId: 202 },
  'Si el filtro actual deja visible un solo plantel, debe conservar exactamente ese equipo'
);

assert.equal(
  resolvePlayerRouteContext({ playerId: 10, requestedTeamId: 999, membershipTeamIds: [101, 202] }).status,
  'invalid-team',
  'Un team manipulado o ajeno al jugador debe fallar cerrado'
);

assert.equal(
  resolvePlayerRouteContext({ playerId: 999, membershipTeamIds: [] }).status,
  'missing',
  'Un jugador inexistente nunca debe convertirse silenciosamente en el primer jugador del filtro'
);

assert.equal(resolvePlayerRouteContext({ playerId: 'x' }).status, 'missing');

console.log('✓ player-route-smoke: filtros guardados, contexto visible/explicito, multi-plantel e IDs inválidos fail-closed OK');
