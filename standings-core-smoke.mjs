import assert from 'node:assert/strict';
import { sortStandingsOlympic } from './standings-core.mjs';

const clubs = [
  { teamId: 1, name: 'A', points: 20, gd: -5, gf: 100, ga: 105 },
  { teamId: 2, name: 'B', points: 20, gd: 0, gf: 110, ga: 110 },
  { teamId: 3, name: 'C', points: 20, gd: 12, gf: 130, ga: 118 },
  { teamId: 4, name: 'D', points: 18, gd: 50, gf: 160, ga: 110 }
];

const matches = [
  { status: 'Finalizado', homeTeamId: 1, awayTeamId: 2, homeScore: 30, awayScore: 20 },
  { status: 'Finalizado', homeTeamId: 1, awayTeamId: 3, homeScore: 25, awayScore: 24 },
  { status: 'Finalizado', homeTeamId: 2, awayTeamId: 3, homeScore: 28, awayScore: 27 },
  // No debe influir porque D no integra el grupo empatado de 20 puntos.
  { status: 'Finalizado', homeTeamId: 4, awayTeamId: 1, homeScore: 40, awayScore: 10 }
];

assert.deepEqual(
  sortStandingsOlympic(clubs, matches).map(row => row.teamId),
  [1, 2, 3, 4],
  'El mini-torneo entre empatados debe prevalecer sobre la diferencia de gol general'
);

const pair = [
  { teamId: 10, name: 'Directo', points: 12, gd: -8, gf: 70, ga: 78 },
  { teamId: 11, name: 'Mejor diferencia general', points: 12, gd: 15, gf: 90, ga: 75 }
];
const pairMatches = [
  { status: 'Finalizado', homeTeamId: 10, awayTeamId: 11, homeScore: 22, awayScore: 21 }
];
assert.deepEqual(
  sortStandingsOlympic(pair, pairMatches).map(row => row.teamId),
  [10, 11],
  'Entre dos empatados debe prevalecer el resultado directo'
);

const noHeadToHead = [
  { teamId: 21, name: 'Menor diferencia', points: 8, gd: 1, gf: 50, ga: 49 },
  { teamId: 22, name: 'Mayor diferencia', points: 8, gd: 4, gf: 45, ga: 41 }
];
assert.deepEqual(
  sortStandingsOlympic(noHeadToHead, []).map(row => row.teamId),
  [22, 21],
  'Sin partidos entre empatados debe usarse el criterio general disponible'
);

console.log('✓ standings-core-smoke: desempate olímpico y fallback general OK');
