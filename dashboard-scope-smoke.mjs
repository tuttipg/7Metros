import fs from 'node:fs';
import assert from 'node:assert/strict';

const pages = fs.readFileSync(new URL('./pages.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('./store.js', import.meta.url), 'utf8');

const dashboardMatch = pages.match(/function renderDashboard\(\) \{([\s\S]*?)\n\}\n\nfunction renderClubes/);
assert.ok(dashboardMatch, 'pages.js: no se encontró renderDashboard');
const dashboard = dashboardMatch[1];

assert.match(
  dashboard,
  /const summary = globalDataSummary\(\)/,
  'Dashboard: los KPI iniciales deben usar el resumen global, no los filtros de competencia'
);
assert.doesNotMatch(
  dashboard,
  /const summary = dataSummary\(\)/,
  'Dashboard: los KPI globales no deben volver a depender de dataSummary filtrado'
);
assert.match(
  dashboard,
  /const matches = getTopDivisionMatches\(\)/,
  'Dashboard: últimos y próximos partidos deben limitarse a Liga de Honor'
);
assert.match(
  dashboard,
  /getTopDivisionStandings\(['"]M['"]\)/,
  'Dashboard: debe mostrar posiciones LHC'
);
assert.match(
  dashboard,
  /getTopDivisionStandings\(['"]F['"]\)/,
  'Dashboard: debe mostrar posiciones LHD'
);
assert.match(
  dashboard,
  /const players = getTopDivisionPlayers\(\)/,
  'Dashboard: destacados deben limitarse a Liga de Honor'
);

const matchScope = store.match(/export function getMatchesForTeamIds\(teamIds\) \{([\s\S]*?)\n\}/);
assert.ok(matchScope, 'store.js: no se encontró getMatchesForTeamIds');
assert.match(
  matchScope[1],
  /allowed\.has\(Number\(match\.homeTeamId\)\)\s*&&\s*allowed\.has\(Number\(match\.awayTeamId\)\)/,
  'store.js: un partido de competencia sólo debe entrar si ambos equipos pertenecen al alcance'
);

const topDivision = store.match(/function isTopHonorTeam\(team\) \{([\s\S]*?)\n\}/);
assert.ok(topDivision, 'store.js: no se encontró isTopHonorTeam');
assert.match(topDivision[1], /categoria\) !== ['"]mayores['"]/, 'Liga de Honor debe restringirse a Mayores');
assert.match(topDivision[1], /includes\(['"]plata['"]\)/, 'Liga de Honor debe excluir explícitamente Plata');
assert.match(topDivision[1], /lh\[cd\]/, 'Liga de Honor debe reconocer LHC/LHD');

console.log('Dashboard scope smoke test: OK');
