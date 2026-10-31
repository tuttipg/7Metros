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
const fresh = {
  marker: 'fresh',
  clubes: [], equipos: [], jugadores: [], planteles: [], partidos: [],
  participaciones: [],
  globalSummary: { clubs: 0, players: 0, matches: 0, finished: 0, goals: 0, avgGoals: null }
};
entries.set(cacheKey, JSON.stringify({ at: Date.now(), dataset: fresh }));
requests = 0;
assert.deepEqual(await loadPublicDataset(3), fresh);
assert.equal(requests, 0, 'caché reciente no debe generar consultas');

// Un timestamp reciente no vuelve confiable un dataset malformado.
// Antes se aceptaba cualquier valor truthy, y prepareDataset().map podía fallar.
for (const [label, dataset] of [
  ['dataset string', 'cached-data'],
  ['colección ausente', { ...fresh, partidos: undefined }],
  ['colección no array', { ...fresh, equipos: 'invalid' }],
  ['fila null', { ...fresh, clubes: [null] }],
  ['resumen no objeto', { ...fresh, globalSummary: [] }]
]) {
  entries.set(cacheKey, JSON.stringify({ at: Date.now(), dataset }));
  requests = 0;
  const reloaded = await loadPublicDataset(3);
  assert.ok(requests >= 2, `${label}: debe ignorar caché malformada y consultar mocks`);
  assert.ok(Array.isArray(reloaded.equipos), `${label}: debe devolver dataset válido`);
  assert.equal(reloaded.marker, undefined, `${label}: no debe devolver caché malformada`);
}

console.log('API cache smoke: fechas y estructura de dataset verificadas');


// El resumen global se consultaba una sola vez por pestaña, incluso después
// de vencer el TTL del dataset. Usar reloj y respuestas simuladas para
// comprobar deduplicación, caducidad, rollback y reintento tras un error.
const realDateNow = Date.now;
let simulatedNow = realDateNow();
let summaryReads = 0;
let nextSummaryValue = 1;
Date.now = () => simulatedNow;
try {
  globalThis.fetch = async input => {
    assert.equal(new URL(input).pathname.split('/').at(-1), 'v_global_summary');
    summaryReads++;
    if (nextSummaryValue === 'error') {
      return new Response(JSON.stringify({ code: 'PGRST000', message: 'offline' }), {
        status: 503, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify([{
      clubes: nextSummaryValue, jugadores: 0, partidos: 0,
      partidos_con_resultado: 0, goles: 0, promedio_goles: null
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const summaryApi = await import('./api.js?summary-ttl-smoke');
  const first = summaryApi.loadGlobalSummaryFast();
  const concurrent = summaryApi.loadGlobalSummaryFast();
  assert.strictEqual(first, concurrent, 'dos consumidores simultáneos comparten una petición');
  assert.equal((await first).clubs, 1);
  assert.equal(summaryReads, 1);

  nextSummaryValue = 2;
  simulatedNow += 120000;
  assert.equal((await summaryApi.loadGlobalSummaryFast()).clubs, 1,
    'un resumen dentro del TTL se puede reutilizar');
  assert.equal(summaryReads, 1);

  simulatedNow += 1;
  assert.equal((await summaryApi.loadGlobalSummaryFast()).clubs, 2,
    'tras vencer el TTL se consulta un resumen actualizado');
  assert.equal(summaryReads, 2);

  nextSummaryValue = 3;
  simulatedNow -= 300000;
  assert.equal((await summaryApi.loadGlobalSummaryFast()).clubs, 3,
    'un reloj que retrocede invalida el resumen');
  assert.equal(summaryReads, 3);

  nextSummaryValue = 'error';
  simulatedNow += 120001;
  await assert.rejects(() => summaryApi.loadGlobalSummaryFast(), summaryApi.DataError,
    'una caída de la vista se propaga');
  nextSummaryValue = 4;
  assert.equal((await summaryApi.loadGlobalSummaryFast()).clubs, 4,
    'un error transitorio no debe quedar cacheado');
  assert.equal(summaryReads, 5);
} finally {
  Date.now = realDateNow;
}

console.log('API global summary cache: concurrencia, TTL, reloj y retry OK');
