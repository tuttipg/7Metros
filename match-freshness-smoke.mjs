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

console.log('match-freshness-smoke: ok');
