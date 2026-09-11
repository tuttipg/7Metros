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

console.log('URL safety smoke test OK');
