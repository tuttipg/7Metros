import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = 4173;
const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function findChrome() {
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const probe = spawnSync('which', [command], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error('No se encontró Chrome/Chromium en el runner');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const relative = normalize(requested).replace(/^[/\\]+/, '');
    if (!relative || relative.startsWith('..')) {
      res.writeHead(400); res.end('bad path'); return;
    }
    const data = await readFile(join(ROOT, relative));
    res.writeHead(200, {
      'Content-Type': MIMES[extname(relative).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, '127.0.0.1', resolve);
});

const chrome = findChrome();
function dumpDom(pathname) {
  const result = spawnSync(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--window-size=412,915',
    '--virtual-time-budget=18000',
    '--run-all-compositor-stages-before-draw',
    '--dump-dom',
    `http://127.0.0.1:${PORT}${pathname}`
  ], {
    encoding: 'utf8',
    timeout: 35000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`Chrome falló en ${pathname}: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

try {
  const matches = dumpDom('/partidos.html');
  assert.match(matches, /<strong class="vs">VS<\/strong>/,
    'Partidos actuales sin marcador deben renderizar VS');
  assert.match(matches, /RESULTADO PENDIENTE|Programado/i,
    'La interfaz debe comunicar que el resultado está pendiente');
  assert.doesNotMatch(matches, /<strong>\s*0<span>–<\/span>0\s*<\/strong>/,
    'No debe aparecer un 0–0 inventado');

  const standings = dumpDom('/posiciones.html');
  assert.match(standings, /Sin posiciones/,
    'La temporada sin resultados verificados no debe producir una tabla deportiva de ceros');

  const stats = dumpDom('/estadisticas.html');
  assert.match(stats, /Sin datos|Todavía no hay registros|Sin balance/i,
    'Sin participaciones verificadas de la temporada, los rankings deben quedar vacíos');

  const clubs = dumpDom('/clubes.html');
  assert.match(clubs, /Sin resultados verificados/,
    'Clubes sin resultados verificados deben comunicarlo en lugar de mostrar 0-0 derivados');
  assert.match(clubs, /Nuestra Señora de Luján/,
    'El club con logo legacy debe seguir visible aunque la imagen remota falle');
  assert.doesNotMatch(clubs, /images\/clubes\/sm\/64\.jpg/,
    'El navegador debe retirar del DOM el logo legacy roto y conservar el fallback');

  const clubProfile = dumpDom('/club.html?id=14&team=9');
  assert.match(clubProfile, /Estadísticas pendientes/,
    'La ficha enriquecida del club no debe convertir ausencia de planillas verificadas en ceros');
  assert.doesNotMatch(clubProfile, /null goles|null PJ|undefined goles|undefined PJ/,
    'Las capas enriquecidas no deben imprimir valores nulos como estadísticas');

  const home = dumpDom('/index.html');
  assert.match(home, /Sin estadísticas verificadas de Liga de Honor/,
    'La portada no debe elegir líderes desde planteles sin participaciones oficiales');

  console.log('Browser smoke: Chrome Android viewport + Supabase read-only OK');
} finally {
  await new Promise(resolve => server.close(resolve));
}
