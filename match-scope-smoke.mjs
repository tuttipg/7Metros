import assert from 'node:assert/strict';

globalThis.window = { SEVEN_METROS_CONFIG: {} };
const { filterMatchesToTeamIds } = await import('./api.js');

const allowed = new Set([10, 11]);
const rows = [
  { id: 1, local_equipo_id: 10, visitante_equipo_id: 11 },
  { id: 2, local_equipo_id: 20, visitante_equipo_id: 21 },
  { id: 3, local_equipo_id: 10, visitante_equipo_id: 21 },
  { id: 4, local_equipo_id: 20, visitante_equipo_id: 11 },
  { id: 5, local_id: 10, visitante_id: 11 },
  { id: 6, local_equipo_id: null, visitante_equipo_id: 11 }
];

assert.deepEqual(
  filterMatchesToTeamIds(rows, allowed).map(row => row.id),
  [1, 5],
  'El fallback debe aceptar sólo partidos cuyos dos equipos pertenecen a la temporada solicitada'
);

assert.deepEqual(
  filterMatchesToTeamIds(rows, [10, 11]).map(row => row.id),
  [1, 5],
  'El helper debe normalizar arrays de IDs sin abrir el alcance'
);

assert.deepEqual(
  filterMatchesToTeamIds(rows, []),
  [],
  'Sin equipos permitidos el fallback debe fallar cerrado'
);

console.log('Match scope smoke test: OK');
