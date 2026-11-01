import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const script = readFileSync(new URL('./script.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('./ui.js', import.meta.url), 'utf8');
const features = readFileSync(new URL('./features.js', import.meta.url), 'utf8');

const expectedPrimary = [
  ['inicio', 'index.html', 'home', 'Inicio'],
  ['competiciones', 'competiciones.html', 'ball', 'Competiciones'],
  ['posiciones', 'posiciones.html', 'standings', 'Posiciones'],
  ['partidos', 'partidos.html', 'calendar', 'Partidos'],
  ['clubes', 'clubes.html', 'shield', 'Clubes'],
  ['jugadores', 'jugadores.html', 'user', 'Jugadores'],
  ['planteles', 'planteles.html', 'users', 'Planteles'],
  ['estadisticas', 'estadisticas.html', 'chart', 'Estadísticas']
];

function primaryBlock(source, label) {
  const marker = label === 'script.js' ? 'primary: [' : 'const primary = [';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${label}: no se encontró la navegación primaria`);
  const end = source.indexOf('\n    ],', start);
  const altEnd = source.indexOf('\n  ];', start);
  const finalEnd = end !== -1 && (altEnd === -1 || end < altEnd) ? end : altEnd;
  assert.notEqual(finalEnd, -1, `${label}: no se pudo delimitar la navegación primaria`);
  return source.slice(start, finalEnd);
}

function assertNavigation(source, label) {
  const block = primaryBlock(source, label);
  let previous = -1;
  for (const [id, href, icon, text] of expectedPrimary) {
    const exact = `['${id}', '${href}', '${icon}', '${text}']`;
    const compact = exact.replaceAll("', '", "','");
    const index = Math.max(block.indexOf(exact), block.indexOf(compact));
    assert.notEqual(index, -1, `${label}: falta ${text} (${href})`);
    assert.ok(index > previous, `${label}: ${text} está fuera de orden`);
    previous = index;
    assert.ok(existsSync(new URL(`./${href}`, import.meta.url)), `${label}: ${href} no existe`);
  }
  const competitions = block.match(/competiciones\.html/g) || [];
  assert.equal(competitions.length, 1, `${label}: Competiciones debe existir exactamente una vez`);
}

assertNavigation(script, 'script.js');
assertNavigation(ui, 'ui.js');

assert.doesNotMatch(
  features,
  /injectCompetitionNav|data\.navCompetitions|\.sidebar \.nav/,
  'features.js: la capa de features no debe crear ni reparar items del menú'
);
assert.match(script, /Promise\.all\(\[/, 'script.js: los módulos principales deben cargarse en paralelo');
assert.doesNotMatch(script, /loadStylesheet\(/, 'script.js: los estilos no deben inyectarse después del render');

console.log('navigation-smoke: OK — navegación única, orden estable y Competiciones sin duplicados.');
