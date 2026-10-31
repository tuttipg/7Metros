import assert from 'node:assert/strict';

// Datos sintéticos: no se consulta FEMEBAL, Supabase ni producción.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
globalThis.window = { SEVEN_METROS_CONFIG: { seasonId: 3, defaults: {} } };

const { prepareDataset, state, getMatchesForTeamIds, getClubsForTeamIds } = await import('./store.js');
const { clubProfileCompetitionScope } = await import('./features.js');

const team = (id, clubId, division = 'LHC') => ({
  id, club_id: clubId, temporada_id: 3, categoria: 'Mayores', division, rama: 'M', activo: true
});
const match = (id, home, away, homeGoals, awayGoals) => ({
  id, local_equipo_id: home, visitante_equipo_id: away, estado: 'finalizado',
  goles_local: homeGoals, goles_visitante: awayGoals, fecha: '2026-10-30', hora: '18:00'
});

prepareDataset({
  clubes: [
    { id: 1, nombre: 'Club A' },
    { id: 2, nombre: 'Club B' },
    { id: 3, nombre: 'Club C' }
  ],
  equipos: [team(101, 1), team(102, 2), team(103, 3, 'Otra división')],
  partidos: [
    match(501, 101, 102, 30, 20),
    match(502, 102, 101, 24, 24),
    match(503, 101, 103, 28, 18), // Fuera de la competencia seleccionada.
    match(504, 102, 103, 19, 21) // No involucra al equipo seleccionado.
  ]
});

// Reproducción: el selector por un solo teamId no sirve para fichas individuales.
assert.equal(getMatchesForTeamIds(new Set([101])).length, 0);
const scope = clubProfileCompetitionScope(state.teams.find(row => row.id === 101));
assert.deepEqual([...scope.teamIds].sort((a, b) => a - b), [101, 102]);
assert.deepEqual(scope.matches.map(row => row.id).sort((a, b) => a - b), [501, 502]);
assert.deepEqual(clubProfileCompetitionScope(null).matches, []);

// Los contadores de la ficha deben usar el mismo alcance competitivo, no el singleton.
const stats = getClubsForTeamIds(scope.teamIds).find(row => row.teamId === 101);
assert.ok(stats);
assert.equal(stats.played, 2);
assert.equal(stats.won, 1);
assert.equal(stats.drawn, 1);
assert.equal(stats.lost, 0);
assert.equal(stats.points, 5);
assert.equal(getClubsForTeamIds(new Set([101]))[0].played, 0);

console.log('club-profile-scope-smoke: ok');
