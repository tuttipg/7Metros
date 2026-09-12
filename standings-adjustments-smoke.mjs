import assert from 'node:assert/strict';
import { applyAdministrativeAdjustments, validateAdministrativeAdjustment } from './standings-adjustments.mjs';

const scope = { seasonId: 4, competitionId: 10, teamIds: [1, 2] };
const valid = {
  teamId: 1,
  seasonId: 4,
  competitionId: 10,
  pointsDelta: -3,
  reason: 'Resolución disciplinaria',
  officialSource: 'https://example.invalid/resolucion-oficial',
  resolutionDate: '2026-09-12'
};
assert.equal(validateAdministrativeAdjustment(valid, scope).valid, true);

for (const missing of ['reason', 'officialSource', 'resolutionDate']) {
  const bad = { ...valid };
  delete bad[missing];
  assert.equal(validateAdministrativeAdjustment(bad, scope).valid, false, `${missing} debe ser obligatorio`);
}
assert.equal(validateAdministrativeAdjustment({ ...valid, pointsDelta: 0 }, scope).valid, false);
assert.equal(validateAdministrativeAdjustment({ ...valid, teamId: 99 }, scope).valid, false);
assert.equal(validateAdministrativeAdjustment({ ...valid, seasonId: 3 }, scope).valid, false);

const clubs = [
  { teamId: 1, name: 'A', points: 12 },
  { teamId: 2, name: 'B', points: 10 }
];
const { rows, rejected } = applyAdministrativeAdjustments(clubs, [valid, { ...valid, teamId: 99 }], scope);
assert.equal(rows[0].sportingPoints, 12);
assert.equal(rows[0].administrativePoints, -3);
assert.equal(rows[0].points, 9);
assert.equal(rows[1].points, 10);
assert.equal(rows[0].appliedAdjustments.length, 1);
assert.equal(rejected.length, 1);

console.log('standings-adjustments-smoke: OK');
