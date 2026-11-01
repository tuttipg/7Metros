import assert from 'node:assert/strict';

// All network responses are local mocks. No real Supabase or production calls.
globalThis.window = globalThis;
globalThis.SEVEN_METROS_CONFIG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseKey: 'public-test-key',
  seasonId: 3,
  defaults: { categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' }
};
// Disable persistence to isolate in-flight deduplication from session caching.
globalThis.sessionStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

const reads = new Map();
let failingSeason = 4;
const count = key => reads.get(key) || 0;
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async input => {
  const url = new URL(input);
  const table = url.pathname.split('/').at(-1);
  const season = url.searchParams.get('temporada_id');
  const key = `${table}:${season ?? 'all'}`;
  reads.set(key, count(key) + 1);
  if (table === 'equipos') {
    // Hold the first request open so two callers overlap deterministically.
    await new Promise(resolve => setTimeout(resolve, 20));
    if (Number(season?.replace('eq.', '')) === failingSeason) {
      return response({ code: 'PGRST000', message: 'offline' }, 503);
    }
  }
  if (table === 'v_global_summary') {
    return response([{
      clubes: 0, jugadores: 0, partidos: 0,
      partidos_con_resultado: 0, goles: 0, promedio_goles: null
    }]);
  }
  return response([]);
};

const { loadPublicDataset, DataError } = await import('./api.js?inflight-dedupe-smoke');

// Before this fix, two simultaneous page consumers started duplicate GETs.
const [first, second] = await Promise.all([loadPublicDataset(3), loadPublicDataset(3)]);
assert.strictEqual(first, second, 'concurrent consumers receive the same dataset');
assert.equal(count('equipos:eq.3'), 1, 'one seasonal teams request, not two');
assert.equal(count('partidos:eq.3'), 1, 'one seasonal matches request, not two');
assert.equal(count('v_global_summary:all'), 1, 'global summary is shared');

// The in-flight map is not a permanent cache: a later call can reload.
await loadPublicDataset(3);
assert.equal(count('equipos:eq.3'), 2, 'a completed load is not kept forever');

// Failures are shared but never retained: a retry must issue a new request.
const failures = await Promise.allSettled([loadPublicDataset(4), loadPublicDataset(4)]);
assert.equal(failures.length, 2);
assert.ok(failures.every(result =>
  result.status === 'rejected' && result.reason instanceof DataError
), 'both callers receive the same controlled error');
assert.equal(count('equipos:eq.4'), 1, 'concurrent failed loads share one request');
failingSeason = null;
await loadPublicDataset(4);
assert.equal(count('equipos:eq.4'), 2, 'a failed load can retry');

// Different seasons must not share the same in-flight dataset.
await Promise.all([loadPublicDataset(5), loadPublicDataset(6)]);
assert.equal(count('equipos:eq.5'), 1);
assert.equal(count('equipos:eq.6'), 1);
assert.equal(count('partidos:eq.5'), 1);
assert.equal(count('partidos:eq.6'), 1);

console.log('API in-flight dedupe: same-season sharing, retry and season isolation OK');
