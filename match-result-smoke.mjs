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

// Regression: malformed match IDs must not produce broken /partido.html?id=... links.
// This is an in-memory dataset; no API calls or database writes occur.
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null };
globalThis.SEVEN_METROS_CONFIG = { seasonId: 3 };
const { prepareDataset, state } = await import('./store.js');
const matchRow = { local_equipo_id: 10, visitante_equipo_id: 11, estado: 'finalizado', goles_local: 2, goles_visitante: 3 };
prepareDataset({
  clubes: [{ id: 1, nombre: 'Local' }, { id: 2, nombre: 'Visitante' }],
  equipos: [{ id: 10, club_id: 1, temporada_id: 3 }, { id: 11, club_id: 2, temporada_id: 3 }],
  partidos: [
    null,
    { ...matchRow, id: null },
    { ...matchRow, id: '' },
    { ...matchRow, id: 'not-an-id' },
    { ...matchRow, id: -1 },
    { ...matchRow, id: 1.5 },
    { ...matchRow, id: '9007199254740992' },
    { ...matchRow, id: 401 },
    { ...matchRow, id: '402' }
  ]
});
assert.deepEqual(state.matches.map(row => row.id), [401, 402],
  'Only valid positive safe integer IDs may generate match links');
assert.deepEqual([...state.index.matchById.keys()], [401, 402],
  'The lookup index must also exclude invalid match IDs');


// Regression: bad club/team/player IDs must not create broken profile links.
// The same positive safe-integer contract already applies to match IDs above.
prepareDataset({
  clubes: [
    { id: null, nombre: 'Invalid null' },
    { id: 0, nombre: 'Invalid zero' },
    { id: -1, nombre: 'Invalid negative' },
    { id: 1.5, nombre: 'Invalid fractional' },
    { id: '9007199254740992', nombre: 'Invalid unsafe' },
    { id: 1, nombre: 'Valid home' },
    { id: 2, nombre: 'Valid away' }
  ],
  equipos: [
    { id: null, club_id: 1, temporada_id: 3 },
    { id: 0, club_id: 1, temporada_id: 3 },
    { id: -2, club_id: 1, temporada_id: 3 },
    { id: 1.5, club_id: 1, temporada_id: 3 },
    { id: '9007199254740992', club_id: 1, temporada_id: 3 },
    { id: 10, club_id: 1, temporada_id: 3 },
    { id: 11, club_id: 2, temporada_id: 3 }
  ],
  jugadores: [
    { id: null, nombre: 'Invalid null' },
    { id: 0, nombre: 'Invalid zero' },
    { id: -1, nombre: 'Invalid negative' },
    { id: 2.5, nombre: 'Invalid fractional' },
    { id: '9007199254740992', nombre: 'Invalid unsafe' },
    { id: 20, nombre: 'Valid player' }
  ],
  partidos: []
});
assert.deepEqual(state.clubs.map(row => row.id), [1, 2],
  'Club links require positive safe integer IDs');
assert.deepEqual(state.teams.map(row => row.id), [10, 11],
  'Team IDs must be safe before building club and player context');
assert.deepEqual(state.players.map(row => row.id), [20],
  'Player links require positive safe integer IDs');


// Regression: a scheduled match carrying an accidental 0-0 and participation
// rows must not create standings or player statistics.
prepareDataset({
  globalSummary: { clubs: 2, players: 1, matches: 1, finished: 0, goals: 0, avgGoals: null },
  clubes: [
    { id: 1, nombre: 'Local' },
    { id: 2, nombre: 'Visitante' }
  ],
  equipos: [
    { id: 10, club_id: 1, temporada_id: 3, categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' },
    { id: 11, club_id: 2, temporada_id: 3, categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' }
  ],
  jugadores: [{ id: 20, nombre: 'Jugador', apellido: 'Prueba' }],
  planteles: [{ id: 1, jugador_id: 20, equipo_id: 10, dorsal: 7, posicion: 'Lateral' }],
  partidos: [{
    id: 501,
    fecha: '2026-11-08',
    local_equipo_id: 10,
    visitante_equipo_id: 11,
    estado: 'programado',
    goles_local: 0,
    goles_visitante: 0
  }],
  participaciones: [{
    id: 1,
    partido_id: 501,
    jugador_id: 20,
    equipo_id: 10,
    goles: 7,
    exclusiones_2min: 1
  }]
});
const pendingPlayer = store.getPlayers().find(player => player.id === 20);
assert.equal(state.matches[0].status, 'Programado');
assert.equal(pendingPlayer.hasOfficialStats, false);
assert.equal(pendingPlayer.matchesPlayed, null, 'una participación sin resultado verificado no acredita PJ');
assert.equal(pendingPlayer.goals, null, 'una participación sin resultado verificado no acredita goles');
assert.equal(store.getMatchParticipations(501, 10).length, 0,
  'el detalle no debe publicar estadísticas del partido hasta validar el resultado');
assert.deepEqual(store.getStandings(), [],
  'sin resultados verificados no debe publicarse una tabla de posiciones llena de ceros');

console.log('Match result evidence smoke test: OK');
