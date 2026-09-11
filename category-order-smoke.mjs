import fs from 'node:fs';
import assert from 'node:assert/strict';

const expected = ['infantiles', 'menores', 'cadetes', 'juveniles', 'juniors', 'mayores'];
const files = ['store.js', 'features.js'];

for (const file of files) {
  const source = fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
  const match = source.match(/(?:categoryOrder|CATEGORY_ORDER)\s*=\s*\[([^\]]+)\]/);
  assert.ok(match, `${file}: no se encontró la definición del orden de categorías`);
  const values = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(row => row[1]);
  assert.deepEqual(values, expected, `${file}: el orden de categorías se desincronizó`);
}

const ui = fs.readFileSync(new URL('./ui.js', import.meta.url), 'utf8');
const features = fs.readFileSync(new URL('./features.js', import.meta.url), 'utf8');

const aliases = {
  infantil: 'Infantiles',
  infantiles: 'Infantiles',
  menor: 'Menores',
  menores: 'Menores',
  cadete: 'Cadetes',
  cadetes: 'Cadetes',
  juvenil: 'Juveniles',
  juveniles: 'Juveniles',
  junior: 'Juniors',
  juniors: 'Juniors',
  mayor: 'Mayores',
  mayores: 'Mayores'
};

for (const [key, label] of Object.entries(aliases)) {
  const pair = new RegExp(`${key}\\s*:\\s*['\"]${label}['\"]`);
  assert.match(ui, pair, `ui.js: falta alias ${key} -> ${label}`);
  assert.match(features, pair, `features.js: falta alias ${key} -> ${label}`);
}

const readme = fs.readFileSync(new URL('./README.md', import.meta.url), 'utf8');
assert.match(
  readme,
  /Infantiles, Menores, Cadetes, Juveniles, Juniors y Mayores/,
  'README.md: la documentación del orden de categorías se desincronizó'
);

console.log('Category order smoke test: OK');
