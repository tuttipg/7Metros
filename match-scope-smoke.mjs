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
  { id: 105, partido_id: null, equipo_id: 10 }
];
assert.deepEqual(
  filterParticipationsToMatches(participations, scopedMatches).map(row => row.id),
  [101, 104],
  'Participaciones de partidos filtrados, huérfanos o sin partido no deben contaminar estadísticas'
);
assert.deepEqual(filterParticipationsToMatches(participations, []), [], 'Sin partidos válidos las participaciones deben fallar cerradas');

console.log('Match scope smoke test: OK');
