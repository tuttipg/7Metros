import fs from 'node:fs';
import assert from 'node:assert/strict';

const pages = fs.readFileSync(new URL('./pages.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('./store.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('./script.js', import.meta.url), 'utf8');

assert.match(
  index,
  /script\.js\?v=20260919-home4/,
  'Home: el bootstrap debe versionarse para evitar HTML nuevo con JS viejo en GitHub Pages'
);
assert.match(
  script,
  /pages\.js\?v=20260919-home4/,
  'Bootstrap: pages.js debe cargarse con la misma versión visible'
);
assert.match(
  script,
  /features\.js\?v=20260919-home4/,
  'Bootstrap: features.js debe cargarse con la misma versión visible'
);

assert.match(
  pages,
  /export function renderDashboardSummary/,
  'Dashboard: debe permitir pintar el resumen global antes del dataset detallado'
);
assert.match(
  script,
  /loadGlobalSummaryFast\(\)/,
  'Bootstrap: Inicio debe pedir el resumen global rápido durante la carga'
);
assert.match(
  script,
  /api\.js\?v=20260919-home4/,
  'Bootstrap: api.js debe versionarse junto al resumen rápido para evitar caché incompatible'
);
assert.match(
  script,
  /typeof api\.loadGlobalSummaryFast === ['"]function['"]/,
  'Bootstrap: una API vieja en caché nunca debe romper la navegación'
);

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
assert.match(
  pages,
  /data-health-finished/,
  'Dashboard: la portada debe exponer cuántos partidos ya tienen resultado'
);
assert.match(
  pages,
  /data-health-scheduled/,
  'Dashboard: la portada debe exponer cuántos partidos siguen programados'
);
assert.match(
  dashboard,
  /Resultados LHC\/LHD pendientes/,
  'Dashboard: el vacío de resultados debe explicar que la importación está pendiente'
);
assert.match(
  dashboard,
  /Sin fechas futuras cargadas/,
  'Dashboard: el vacío de calendario debe explicar el límite de cobertura'
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
