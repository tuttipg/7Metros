import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./posiciones.html', import.meta.url), 'utf8');

assert.match(html, /3 puntos por victoria, 2 por empate y 1 por derrota ordinaria/, 'La UI debe explicar el puntaje FEMEBAL 3-2-1');
assert.doesNotMatch(html, /2 puntos por victoria, 1 por empate y 0 por derrota/, 'No debe reaparecer la explicación obsoleta 2-1-0');
assert.match(html, /Sistema Olímpico/, 'La UI debe informar que el desempate comienza por enfrentamientos directos');

console.log('standings-copy-smoke: ok');
