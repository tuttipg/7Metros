import assert from 'node:assert/strict';

globalThis.window = { SEVEN_METROS_CONFIG: {} };
const { filterMatchesToTeamIds, filterParticipationsToMatches } = await import('./api.js');

const allowed = new Set([10, 11]);
const rows = [
  { id: 1, local_equipo_id: 10, visitante_equipo_id: 11 },
  { id: 2, local_equipo_id: 20, visitante_equipo_id: 21 },
  { id: 3, local_equipo_id: 10, visitante_equipo_id: 21 },
  { id: 4, local_equipo_id: 20, visitante_equipo_id: 11 },
  { id: 5, local_id: 10, visitante_id: 11 },
  { id: 6, local_equipo_id: null, visitante_equipo_id: 11 }
];

const scopedMatches = filterMatchesToTeamIds(rows, allowed);
assert.deepEqual(scopedMatches.map(row => row.id), [1, 5], 'Sólo deben sobrevivir partidos con ambos equipos dentro de temporada');
assert.deepEqual(filterMatchesToTeamIds(rows, [10, 11]).map(row => row.id), [1, 5], 'El helper debe normalizar arrays de IDs sin abrir el alcance');
assert.deepEqual(filterMatchesToTeamIds(rows, []), [], 'Sin equipos permitidos el filtro debe fallar cerrado');

const participations = [
  { id: 101, partido_id: 1, equipo_id: 10 },
  { id: 102, partido_id: 3, equipo_id: 10 },
  { id: 103, partido_id: 999, equipo_id: 10 },
  { id: 104, partido_id: 5, equipo_id: 11 },
  { id: 105, partido_id: null, equipo_id: 10 },
  { id: 106, partido_id: 1, equipo_id: 12 },
  { id: 107, partido_id: 5, equipo_id: null }
];
assert.deepEqual(
  filterParticipationsToMatches(participations, scopedMatches).map(row => row.id),
  [101, 104],
  'Participaciones de partidos filtrados, huérfanos, sin partido o con equipo ajeno al partido no deben contaminar estadísticas'
);
assert.deepEqual(filterParticipationsToMatches(participations, []), [], 'Sin partidos válidos las participaciones deben fallar cerradas');

// Regresión: IDs inválidos no deben convertirse en cero ni contaminar relaciones.
const malformedMatches = [
  { id: 201, local_equipo_id: 0, visitante_equipo_id: 11 },
  { id: 202, local_equipo_id: 10, visitante_equipo_id: 0 },
  { id: 203, local_equipo_id: '1e1', visitante_equipo_id: 11 },
  { id: 204, local_equipo_id: true, visitante_equipo_id: 11 },
  { id: null, local_equipo_id: 10, visitante_equipo_id: 11 },
  { id: '9007199254740993', local_equipo_id: 10, visitante_equipo_id: 11 },
  { id: '205', local_equipo_id: '10', visitante_equipo_id: '11' }
];
const validMalformedMatches = filterMatchesToTeamIds(malformedMatches, new Set([0, 10, 11]));
assert.deepEqual(validMalformedMatches.map(row => row.id), ['205'],
  'IDs 0, booleanos, exponenciales, null y fuera de rango no deben ingresar a partidos');
const malformedParticipations = [
  { id: 301, partido_id: 205, equipo_id: null },
  { id: 302, partido_id: 205, equipo_id: 0 },
  { id: 303, partido_id: 205, equipo_id: '1e1' },
  { id: 304, partido_id: null, equipo_id: 10 },
  { id: 305, partido_id: 0, equipo_id: 10 },
  { id: 306, partido_id: '9007199254740993', equipo_id: 10 },
  { id: 307, partido_id: '205', equipo_id: '10' },
  { id: 308, partido_id: 205, equipo_id: true },
  { id: 309, partido_id: 205, equipo_id: 10.5 },
  { id: 310, partido_id: 205, equipo_id: ' 10' }
];
assert.deepEqual(filterParticipationsToMatches(malformedParticipations, validMalformedMatches)
  .map(row => row.id), [307], 'una participación inválida no debe asociarse a un partido válido');
assert.deepEqual(filterParticipationsToMatches(
  [{ id: 999, partido_id: 777, equipo_id: null }],
  [{ id: 777, local_equipo_id: 0, visitante_equipo_id: 11 }]
), [], 'equipo_id null no debe coincidir con local_equipo_id 0');

console.log('Match scope smoke test: OK');
