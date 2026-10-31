import assert from 'node:assert/strict';
import { matchUiStatus } from './match-freshness-core.mjs';

assert.deepEqual(
  matchUiStatus({ status: 'Finalizado', date: '2026-09-01', homeScore: 25, awayScore: 20 }, '2026-09-12'),
  { code: 'final', label: 'Finalizado' }
);

assert.deepEqual(
  matchUiStatus({ status: 'Programado', date: '2026-09-11', homeScore: null, awayScore: null }, '2026-09-12'),
  { code: 'result-pending', label: 'Resultado pendiente' }
);

assert.deepEqual(
  matchUiStatus({ status: 'Programado', date: '2026-09-12', homeScore: null, awayScore: null }, '2026-09-12'),
  { code: 'scheduled', label: 'Programado' }
);

assert.deepEqual(
  matchUiStatus({ status: 'Programado', date: '2026-09-13', homeScore: null, awayScore: null }, '2026-09-12'),
  { code: 'scheduled', label: 'Programado' }
);

assert.deepEqual(
  matchUiStatus({ status: 'Programado', date: '2026-09-11', homeScore: 20, awayScore: 20 }, '2026-09-12'),
  { code: 'scheduled', label: 'Programado' }
);

// Regression: la ficha de club no debe llamar "Próximo partido" a un encuentro
// cuyo estado oficial es desconocido, aunque tenga fecha futura.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
globalThis.window = { SEVEN_METROS_CONFIG: { seasonId: 3, defaults: {} } };
const { isUpcomingScheduledMatch } = await import('./features.js');
const today = '2026-10-30';
assert.equal(isUpcomingScheduledMatch({ status: 'Programado', date: today }, today), true);
assert.equal(isUpcomingScheduledMatch({ status: 'Programado', date: '2026-11-01' }, today), true);
assert.equal(isUpcomingScheduledMatch({ status: 'Programado', date: '2026-10-29' }, today), false);
assert.equal(isUpcomingScheduledMatch({ status: 'Sin resultado', date: '2026-11-01' }, today), false);
assert.equal(isUpcomingScheduledMatch({ status: 'Finalizado', date: '2026-11-01' }, today), false);
assert.equal(isUpcomingScheduledMatch({ status: '', date: '2026-11-01' }, today), false);
assert.equal(isUpcomingScheduledMatch({ status: 'Programado', date: 'sin fecha' }, today), false);
assert.equal(isUpcomingScheduledMatch(null, today), false);

console.log('match-freshness-smoke: ok');
