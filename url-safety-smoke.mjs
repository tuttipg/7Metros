import fs from 'node:fs';
globalThis.window = globalThis.window || {};

const { safeHttpUrl } = await import('./utils.js');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
  }
}

assertEqual(safeHttpUrl('https://example.com/path?q=1'), 'https://example.com/path?q=1', 'acepta HTTPS normal');
assertEqual(safeHttpUrl('http://example.com/path'), 'http://example.com/path', 'acepta HTTP normal');
assertEqual(safeHttpUrl('javascript:alert(1)'), null, 'rechaza javascript');
assertEqual(safeHttpUrl('data:text/html,<script>alert(1)</script>'), null, 'rechaza data');
assertEqual(safeHttpUrl('https://user:secret@example.com/path'), null, 'rechaza credenciales embebidas');
assertEqual(safeHttpUrl('http://user@example.com/'), null, 'rechaza username sin password');
assertEqual(safeHttpUrl('/ruta/relativa'), null, 'rechaza URL relativa');
assertEqual(safeHttpUrl('no-es-url'), null, 'rechaza texto inválido');
assertEqual(safeHttpUrl(''), null, 'rechaza vacío');

const uiSource = fs.readFileSync(new URL('./ui.js', import.meta.url), 'utf8');
const identityCss = fs.readFileSync(new URL('./identity.css', import.meta.url), 'utf8');
if (!/referrerpolicy="no-referrer"/.test(uiSource)) throw new Error('los escudos remotos deben evitar referrer hotlinking');
if (!/onload="this\.classList\.add\('is-loaded'\)"/.test(uiSource)) throw new Error('el fallback sólo debe ocultarse tras carga real');
if (!/:has\(>img\.is-loaded\)>span/.test(identityCss)) throw new Error('CSS debe conservar iniciales hasta carga exitosa');
if (!/img:not\(\.is-loaded\)/.test(identityCss)) throw new Error('una imagen remota no cargada no debe dejar un hueco visual');

console.log('URL safety + club logo fallback smoke test OK');
