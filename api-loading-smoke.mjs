import assert from 'node:assert/strict';

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
  const { supabaseGetByIds, DataError } = await import('./api.js');

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

  console.log('api-loading-smoke: OK — chunks concurrentes acotados y fail-closed.');
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.SEVEN_METROS_CONFIG;
  delete globalThis.window;
}
