import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hasVerifiedMatchResult, matchPublicStatus } from './match-result-core.mjs';

const cases = [
  [{ estado: 'finalizado', goles_local: 30, goles_visitante: 28 }, true, 'Finalizado'],
  [{ estado: ' FINAL ', goles_local: '0', goles_visitante: '0' }, true, 'Finalizado'],
  [{ estado: '', goles_local: 24, goles_visitante: 22 }, true, 'Finalizado'],
  [{ estado: 'programado', goles_local: 0, goles_visitante: 0 }, false, 'Programado'],
  [{ estado: 'finalizado', goles_local: null, goles_visitante: null }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: 22, goles_visitante: null }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: '', goles_visitante: '22' }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: -1, goles_visitante: 22 }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: 21.5, goles_visitante: 22 }, false, 'Sin resultado'],
  // Decimal score strings are supported, but JS coercion must not invent scores.
  [{ estado: 'finalizado', goles_local: ' 12 ', goles_visitante: '000' }, true, 'Finalizado'],
  [{ estado: 'finalizado', goles_local: '0x10', goles_visitante: 22 }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: '1e2', goles_visitante: 22 }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: '2.0', goles_visitante: 22 }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: '+2', goles_visitante: 22 }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: [], goles_visitante: 22 }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: [0], goles_visitante: 22 }, false, 'Sin resultado'],
  [{ estado: 'finalizado', goles_local: '9007199254740992', goles_visitante: 22 }, false, 'Sin resultado'],
  [{ estado: 'cancelado', goles_local: 0, goles_visitante: 0 }, false, 'Sin resultado'],
  [{ estado: 'suspendido', goles_local: 10, goles_visitante: 9 }, false, 'Sin resultado'],
  [{ estado: 'programado', goles_local: null, goles_visitante: null }, false, 'Programado'],
  // Unknown legacy status without a complete result must not be shown as upcoming.
  [{ estado: null, goles_local: null, goles_visitante: null }, false, 'Sin resultado'],
  [{ estado: '  ', goles_local: null, goles_visitante: null }, false, 'Sin resultado'],
  [{}, false, 'Sin resultado'],
  [null, false, 'Sin resultado']
];
for (const [row, expectedResult, expectedStatus] of cases) {
  assert.equal(hasVerifiedMatchResult(row), expectedResult, JSON.stringify(row));
  assert.equal(matchPublicStatus(row), expectedStatus, JSON.stringify(row));
}

const api = fs.readFileSync(new URL('./api.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('./store.js', import.meta.url), 'utf8');
assert.match(api, /matches\.filter\(hasVerifiedMatchResult\)/, 'El resumen fallback debe usar el criterio compartido');
assert.match(store, /const finished = hasVerifiedMatchResult\(row\)/, 'El store debe usar el criterio compartido');
assert.match(store, /status: matchPublicStatus\(row\)/, 'El store debe distinguir un resultado no verificable');
const matchesPage = fs.readFileSync(new URL('./partidos.html', import.meta.url), 'utf8');
const pages = fs.readFileSync(new URL('./pages.js', import.meta.url), 'utf8');
assert.match(matchesPage, /<option value="Sin resultado">Sin resultado<\/option>/,
  'Los partidos sin resultado verificable deben poder filtrarse explícitamente');
assert.match(matchesPage, /<option value="Programado">Programados<\/option>/,
  'El filtro por estado incluye también programados anteriores; no debe llamarse Próximos');
assert.match(matchesPage, /<option value="asc">Más antiguos primero<\/option>/,
  'Orden ascendente por fecha no significa el próximo partido');
assert.match(pages, /m\.status === statusValue/,
  'El filtro de partidos debe comparar los estados visibles, incluido Sin resultado');

console.log('Match result evidence smoke test: OK');
