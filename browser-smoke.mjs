import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = 4173;
const DEBUG_PORT = 9222;
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

const chrome = spawn(findChrome(), [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--remote-debugging-address=127.0.0.1',
  '--user-data-dir=/tmp/7metros-browser-smoke',
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

async function waitForDebugger() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Chrome no abrió el puerto DevTools');
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const detail = message.params?.exceptionDetails;
        this.exceptions.push(detail?.exception?.description || detail?.text || 'Runtime exception');
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function createTab() {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' });
  assert.ok(response.ok, 'Chrome debe permitir crear una pestaña de prueba');
  const target = await response.json();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 412, height: 915, deviceScaleFactor: 2, mobile: true
  });
  return cdp;
}

async function loadPage(pathname, readyExpression) {
  const cdp = await createTab();
  try {
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${pathname}` });
    const expression = `(async () => {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        try {
          if (${readyExpression}) break;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        ready: (() => { try { return Boolean(${readyExpression}); } catch { return false; } })(),
        html: document.documentElement.outerHTML,
        title: document.title,
        busy: document.body?.getAttribute('aria-busy') || ''
      };
    })()`;
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    const value = result.result?.value;
    assert.ok(value?.ready, `${pathname}: la UI dinámica no llegó al estado esperado`);
    assert.equal(value.busy, '', `${pathname}: la página quedó marcada como cargando`);
    assert.deepEqual(cdp.exceptions, [], `${pathname}: no debe lanzar excepciones JS`);
    return value.html;
  } finally {
    cdp.close();
  }
}

try {
  await waitForDebugger();

  const matches = await loadPage('/partidos.html',
    `document.querySelector('#match-count')?.textContent?.trim() !== '—' && document.querySelector('.match-row')`);
  assert.match(matches, /<strong class="vs">VS<\/strong>/,
    'Partidos actuales sin marcador deben renderizar VS');
  assert.match(matches, /RESULTADO PENDIENTE|Resultado pendiente/i,
    'La interfaz debe comunicar que el resultado está pendiente');
  assert.doesNotMatch(matches, /<strong>\s*0<span>–<\/span>0\s*<\/strong>/,
    'No debe aparecer un 0–0 inventado');

  const standings = await loadPage('/posiciones.html',
    `document.querySelector('#standings-body')?.textContent?.trim().length > 0`);
  assert.match(standings, /Sin posiciones/,
    'La temporada sin resultados verificados no debe producir una tabla deportiva de ceros');

  const stats = await loadPage('/estadisticas.html',
    `document.querySelector('#goals-list')?.textContent?.trim().length > 0`);
  assert.match(stats, /Sin datos|Todavía no hay registros|Sin balance/i,
    'Sin participaciones verificadas de la temporada, los rankings deben quedar vacíos');

  const clubs = await loadPage('/clubes.html',
    `document.querySelector('#club-count')?.textContent?.trim() !== '—' && document.querySelector('.club-card')`);
  assert.match(clubs, /Sin resultados verificados/,
    'Clubes sin resultados verificados deben comunicarlo en lugar de mostrar 0-0 derivados');
  assert.match(clubs, /Nuestra Señora de Luján/,
    'El club con logo legacy debe seguir visible aunque la imagen remota falle');
  assert.doesNotMatch(clubs, /images\/clubes\/sm\/64\.jpg/,
    'El navegador debe retirar del DOM el logo legacy roto y conservar el fallback');

  const clubProfile = await loadPage('/club.html?id=14&team=9',
    `document.querySelector('#club-detail .pro-club-hero')`);
  assert.match(clubProfile, /Estadísticas pendientes/,
    'La ficha enriquecida del club no debe convertir ausencia de planillas verificadas en ceros');
  assert.doesNotMatch(clubProfile, /null goles|null PJ|undefined goles|undefined PJ/,
    'Las capas enriquecidas no deben imprimir valores nulos como estadísticas');

  const home = await loadPage('/index.html',
    `document.querySelector('[data-kpi="clubs"]')?.textContent?.trim() !== '—' && document.querySelector('#dashboard-highlights')?.textContent?.trim().length > 0`);
  assert.match(home, /Sin estadísticas verificadas de Liga de Honor/,
    'La portada no debe elegir líderes desde planteles sin participaciones oficiales');

  console.log('Browser smoke: Chrome Android viewport + Supabase read-only OK');
} finally {
  chrome.kill('SIGTERM');
  await new Promise(resolve => server.close(resolve));
}
