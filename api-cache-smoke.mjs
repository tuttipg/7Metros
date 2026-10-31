import assert from 'node:assert/strict';

// Datos y red simulados: no se consulta ningún servicio externo.
globalThis.window = globalThis;
globalThis.SEVEN_METROS_CONFIG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseKey: 'public-test-key',
  seasonId: 3,
  defaults: { categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' }
};

const cacheKey = '7m:dataset:public-v1:3';
const entries = new Map();
globalThis.sessionStorage = {
  getItem(key) { return entries.get(key) ?? null; },
  setItem(key, value) { entries.set(key, value); },
  removeItem(key) { entries.delete(key); }
};

let requests = 0;
globalThis.fetch = async input => {
  requests++;
  const table = new URL(input).pathname.split('/').at(-1);
  const payload = table === 'v_global_summary'
    ? [{ clubes: 0, jugadores: 0, partidos: 0, partidos_con_resultado: 0,
      goles: 0, promedio_goles: null }]
    : [];
  return new Response(JSON.stringify(payload), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
};

const { loadPublicDataset } = await import('./api.js');

// Antes, una fecha futura o no numérica producía un age negativo/NaN;
// la comparación con TTL era falsa y se aceptaban datos obsoletos indefinidamente.
for (const [label, at] of [
  ['fecha futura', Date.now() + 60 * 60 * 1000],
  ['fecha no numérica', 'not-a-timestamp'],
  ['fecha vencida', Date.now() - 3 * 60 * 1000]
]) {
  entries.set(cacheKey, JSON.stringify({ at, dataset: { marker: label } }));
  requests = 0;
  const dataset = await loadPublicDataset(3);
  assert.ok(requests >= 2, `${label}: debe ignorar caché inválida y leer los datos simulados`);
  assert.ok(Array.isArray(dataset.equipos), `${label}: debe devolver un dataset nuevo`);
  assert.equal(dataset.marker, undefined, `${label}: no debe usar caché vieja`);
}

// Una entrada válida y reciente debe conservar el beneficio de carga instantánea.
const fresh = { marker: 'fresh' };
entries.set(cacheKey, JSON.stringify({ at: Date.now(), dataset: fresh }));
requests = 0;
assert.deepEqual(await loadPublicDataset(3), fresh);
assert.equal(requests, 0, 'caché reciente no debe generar consultas');

console.log('API cache smoke: fecha futura, corrupta, vencida y válida OK');
