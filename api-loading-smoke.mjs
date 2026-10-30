import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiSource = fs.readFileSync(new URL('./api.js', import.meta.url), 'utf8');
assert.match(apiSource, /SESSION_CACHE_TTL/, 'public dataset should use a short session cache');
assert.match(apiSource, /const \[planteles, partidos, rawParticipaciones\] = await Promise\.all/, 'independent public reads should run in parallel');

const originalFetch = globalThis.fetch;

// api.js importa config.js, que en producción lee window.SEVEN_METROS_CONFIG.
// El smoke corre en Node, por lo que simulamos únicamente ese contrato público mínimo.
globalThis.window = globalThis;
globalThis.SEVEN_METROS_CONFIG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseKey: 'public-test-key',
  seasonId: 3,
  seasonLabel: 'CLAUSURA 2026',
  defaults: { categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' },
  links: {}
};

let active = 0;
let maxActive = 0;
let calls = 0;

globalThis.fetch = async () => {
  calls += 1;
  active += 1;
  maxActive = Math.max(maxActive, active);
  await new Promise(resolve => setTimeout(resolve, 12));
  active -= 1;
  return new Response('[]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { supabaseGetByIds, supabaseCount, DataError } = await import('./api.js');

  const ids = Array.from({ length: 250 }, (_, i) => i + 1);
  const rows = await supabaseGetByIds('planteles', 'equipo_id', ids, 'id', {
    chunkSize: 100,
    concurrency: 2
  });

  assert.deepEqual(rows, []);
  assert.equal(calls, 3, '250 IDs / bloques de 100 deben producir 3 requests');
  assert.equal(maxActive, 2, 'la lectura debe usar concurrencia acotada');
  assert.ok(maxActive <= 2, 'nunca debe exceder la concurrencia solicitada');

  await assert.rejects(
    () => supabaseGetByIds('planteles', 'equipo_id', [1], 'id', { concurrency: 7 }),
    DataError,
    'la concurrencia superior al techo SAFE debe rechazarse'
  );

  // Un count exacto no puede inferirse de una página Range: 0-0.
  // Las respuestas son simuladas; no hay acceso a la base de datos real.
  let countHeader = '0-0/147';
  let countCalls = 0;
  globalThis.fetch = async (_url, options) => {
    countCalls++;
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Prefer, 'count=exact');
    return new Response('[]', {
      status: 200,
      headers: countHeader === null ? {} : { 'Content-Range': countHeader }
    });
  };

  assert.equal(await supabaseCount('clubes'), 147, 'el total debe venir de Content-Range');
  countHeader = '*/0';
  assert.equal(await supabaseCount('clubes'), 0, 'una tabla vacía tiene total exacto cero');
  countHeader = null;
  await assert.rejects(() => supabaseCount('clubes'), DataError,
    'sin Content-Range no se debe presentar la página parcial como total');
  countHeader = '0-0/*';
  await assert.rejects(() => supabaseCount('clubes'), DataError,
    'un total desconocido no se debe presentar como cero');
  countHeader = '0-0/9007199254740992';
  await assert.rejects(() => supabaseCount('clubes'), DataError,
    'un conteo fuera del rango de enteros seguros debe rechazarse');
  assert.equal(countCalls, 5);

  console.log('api-loading-smoke: OK — concurrencia acotada y conteos exactos fail-closed.');
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.SEVEN_METROS_CONFIG;
  delete globalThis.window;
}
