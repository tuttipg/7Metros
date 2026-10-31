import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiSource = fs.readFileSync(new URL('./api.js', import.meta.url), 'utf8');
assert.match(apiSource, /SESSION_CACHE_TTL/, 'keep short-lived session cache from main');
assert.match(apiSource, /writeDatasetCache\(season, dataset\)/, 'keep dataset cache write from main');
assert.match(apiSource, /const \[planteles, partidos, rawParticipaciones\] = await Promise\.all/, 'keep parallel seasonal reads from main');

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

  // Regresión de IDs: Number(null), Number('') y enteros > MAX_SAFE_INTEGER
  // antes terminaban en consultas por 0 o IDs redondeados.
  const idQueries = [];
  globalThis.fetch = async input => {
    idQueries.push(new URL(input).searchParams.get('equipo_id'));
    return new Response('[]', { status: 200 });
  };
  await supabaseGetByIds('planteles', 'equipo_id', [
    null, undefined, '', ' 4 ', '01', '1e3', -3, 0, 2.5,
    '9007199254740993', Number.MAX_SAFE_INTEGER + 1, true, '1', 2, 2
  ], 'id');
  assert.deepEqual(idQueries, ['in.(1,2)'],
    'solo IDs decimales canónicos, positivos y seguros deben llegar a la API');
  idQueries.length = 0;
  assert.deepEqual(await supabaseGetByIds('planteles', 'equipo_id', [
    null, '', '1e3', Number.MAX_SAFE_INTEGER + 1
  ], 'id'), []);
  assert.deepEqual(idQueries, [], 'IDs inválidos no deben generar requests');


  await assert.rejects(
    () => supabaseGetByIds('planteles', 'equipo_id', [1], 'id', { concurrency: 7 }),
    DataError,
    'la concurrencia superior al techo SAFE debe rechazarse'
  );

  // Todas las respuestas siguientes son mocks locales: nunca se consulta Supabase.
  // Una caída/pausa de la API no debe desencadenar un segundo GET global de partidos.
  const mockJson = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json' }
  });
  let mode = 'paused';
  let scopedReads = 0;
  let globalReads = 0;
  globalThis.fetch = async input => {
    const url = new URL(input);
    const table = url.pathname.split('/').at(-1);
    if (table === 'v_global_summary') {
      return mockJson([{ clubes: 1, jugadores: 0, partidos: 1,
        partidos_con_resultado: 0, goles: 0, promedio_goles: null }]);
    }
    if (table === 'equipos') {
      return mockJson([
        { id: 10, club_id: 1, temporada_id: 3 },
        { id: 11, club_id: 1, temporada_id: 3 }
      ]);
    }
    if (table === 'clubes') return mockJson([{ id: 1, nombre: 'Club de prueba' }]);
    if (table === 'partidos') {
      if (url.searchParams.has('temporada_id')) {
        scopedReads++;
        if (mode === 'paused') {
          return mockJson({ code: 'PGRST000', message: 'Servicio temporalmente no disponible' }, 503);
        }
        if (mode === 'unrelated') {
          return mockJson({ code: '42703', message: 'column partidos.otra_columna does not exist' }, 400);
        }
        return mockJson({ code: '42703', message: 'column partidos.temporada_id does not exist' }, 400);
      }
      globalReads++;
      return mockJson([
        { id: 401, local_equipo_id: 10, visitante_equipo_id: 11 },
        { id: 402, local_equipo_id: 10, visitante_equipo_id: 99 }
      ]);
    }
    return mockJson([]);
  };

  const { loadPublicDataset } = await import('./api.js');
  await assert.rejects(() => loadPublicDataset(3), DataError,
    'un servicio caído debe informar el error sin consulta global de partidos');
  assert.equal(scopedReads, 1);
  assert.equal(globalReads, 0, 'un 503 no habilita fallback global');

  mode = 'unrelated';
  await assert.rejects(() => loadPublicDataset(3), DataError,
    'una columna faltante diferente no habilita fallback global');
  assert.equal(scopedReads, 2);
  assert.equal(globalReads, 0, 'un 42703 ajeno a temporada_id no habilita fallback');

  mode = 'legacy';
  const legacy = await loadPublicDataset(3);
  assert.equal(scopedReads, 3);
  assert.equal(globalReads, 1, 'sólo la ausencia comprobada de temporada_id habilita fallback');
  assert.deepEqual(legacy.partidos.map(row => row.id), [401],
    'el fallback legacy debe mantener el scope de ambos equipos');

  // Regresión independiente para el resumen global: una caída de la vista no debe
  // convertirse silenciosamente en counts + lectura completa de partidos.
  let summaryMode = 'paused';
  let summaryGlobalMatchReads = 0;
  globalThis.fetch = async input => {
    const url = new URL(input);
    const table = url.pathname.split('/').at(-1);

    if (table === 'v_global_summary') {
      if (summaryMode === 'paused') {
        return mockJson({ code: 'PGRST000', message: 'Servicio temporalmente no disponible' }, 503);
      }
      if (summaryMode === 'empty-view') return mockJson([]);
      return mockJson({
        code: 'PGRST205',
        message: "Could not find the table 'public.v_global_summary' in the schema cache"
      }, 404);
    }

    if (table === 'equipos') {
      return mockJson([
        { id: 10, club_id: 1, temporada_id: 3 },
        { id: 11, club_id: 1, temporada_id: 3 }
      ]);
    }
    if (table === 'clubes') {
      return new Response(JSON.stringify([{ id: 1, nombre: 'Club de prueba' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' }
      });
    }
    if (table === 'jugadores') {
      return new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' }
      });
    }
    if (table === 'partidos') {
      if (url.searchParams.has('temporada_id')) return mockJson([]);
      summaryGlobalMatchReads++;
      return mockJson([
        { id: 900, estado: 'finalizado', goles_local: 20, goles_visitante: 25 },
        { id: 901, estado: 'finalizado', goles_local: null, goles_visitante: 0 },
        { id: 902, estado: 'finalizado', goles_local: '1e2', goles_visitante: 10 }
      ]);
    }
    return mockJson([]);
  };

  const summaryApi = await import('./api.js?summary-fallback-smoke');
  await assert.rejects(
    () => summaryApi.loadPublicDataset(3),
    summaryApi.DataError,
    'una caída del resumen global debe propagarse sin disparar lectura completa de partidos'
  );
  assert.equal(summaryGlobalMatchReads, 0, 'un 503 del resumen global no habilita fallback global');

  summaryMode = 'legacy-missing-view';
  const legacySummary = await summaryApi.loadPublicDataset(3);
  assert.equal(summaryGlobalMatchReads, 1, 'sólo una vista realmente ausente habilita fallback global');
  assert.equal(legacySummary.globalSummary.matches, 3);
  assert.equal(legacySummary.globalSummary.finished, 1,
    'el resumen legacy no debe contar finales sin marcador completo o con notación inválida');
  assert.equal(legacySummary.globalSummary.goals, 45,
    'el resumen legacy sólo debe sumar goles de resultados verificados');

  // Una vista existente que responde [] NO está ausente: no descargar todos
  // los partidos como si fuera un esquema legacy (costo alto e inesperado).
  summaryMode = 'empty-view';
  const emptySummaryApi = await import('./api.js?empty-summary-view-smoke');
  await assert.rejects(
    () => emptySummaryApi.loadPublicDataset(3),
    error => error instanceof emptySummaryApi.DataError && /no devolvió filas/.test(error.message),
    'la vista vacía debe informar error y no autorizar fallback global'
  );
  assert.equal(summaryGlobalMatchReads, 1, 'la vista vacía no debe provocar otra lectura global');

  // El resumen puede fallar antes de que responda equipos. Si el rechazo no
  // tiene handler desde el inicio, Node emite unhandledRejection y el navegador
  // puede reportar un error global aunque el caller maneje loadPublicDataset.
  const earlyUnhandled = [];
  const onEarlyUnhandled = error => earlyUnhandled.push(error);
  process.on('unhandledRejection', onEarlyUnhandled);
  try {
    globalThis.fetch = async input => {
      const table = new URL(input).pathname.split('/').at(-1);
      if (table === 'v_global_summary') {
        return mockJson({ code: 'PGRST000', message: 'Servicio temporalmente no disponible' }, 503);
      }
      if (table === 'equipos') {
        await new Promise(resolve => setTimeout(resolve, 30));
        return mockJson([{ id: 10, club_id: 1, temporada_id: 3 }]);
      }
      if (table === 'clubes') return mockJson([{ id: 1, nombre: 'Club de prueba' }]);
      return mockJson([]);
    };
    const earlyApi = await import('./api.js?summary-early-rejection-smoke');
    await assert.rejects(() => earlyApi.loadPublicDataset(3), earlyApi.DataError,
      'el error del resumen debe llegar al caller incluso si equipos responde después');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(earlyUnhandled, [], 'no debe haber rechazos de Promise sin manejar');
  } finally {
    process.off('unhandledRejection', onEarlyUnhandled);
  }

  // Conteos exactos: Range 0-0 nunca permite inferir el total desde la página.
  // Todos los casos son mocks y no se realizan consultas externas.
  const countApi = await import('./api.js?exact-count-smoke');
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
  assert.equal(await countApi.supabaseCount('clubes'), 147);
  countHeader = '*/0';
  assert.equal(await countApi.supabaseCount('clubes'), 0);
  countHeader = null;
  await assert.rejects(() => countApi.supabaseCount('clubes'), countApi.DataError);
  countHeader = '0-0/*';
  await assert.rejects(() => countApi.supabaseCount('clubes'), countApi.DataError);
  countHeader = '0-0/9007199254740992';
  await assert.rejects(() => countApi.supabaseCount('clubes'), countApi.DataError);
  assert.equal(countCalls, 5, 'no se debe intentar un segundo GET para inferir el total');

  // Regresión: fetch puede entregar headers, pero el body JSON no terminar.
  // Simular el reloj evita esperar 15 segundos y comprueba el abort del body.
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  let expireRequest = null;
  let timeoutCleared = false;
  try {
    globalThis.setTimeout = (callback, ms, ...args) => {
      if (ms === 15000) {
        expireRequest = () => callback(...args);
        return 900001;
      }
      return realSetTimeout(callback, ms, ...args);
    };
    globalThis.clearTimeout = timer => {
      if (timer === 900001) { timeoutCleared = true; return; }
      return realClearTimeout(timer);
    };
    const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
    globalThis.fetch = async (_url, { signal }) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        if (signal.aborted) { reject(abortError()); return; }
        signal.addEventListener('abort', () => reject(abortError()), { once: true });
      })
    });

    const pending = countApi.supabaseGetAll('partidos', '?select=id');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof expireRequest, 'function', 'se debe programar el timeout');
    expireRequest();
    await assert.rejects(pending, error =>
      error instanceof countApi.DataError && /tiempo de espera/.test(error.message),
    'el timeout debe incluir la lectura del JSON');
    assert.equal(timeoutCleared, true, 'el temporizador debe limpiarse tras abortar');
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  }

  console.log('api-loading-smoke: OK — fallbacks, conteos exactos y timeout de body verificados.');
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.SEVEN_METROS_CONFIG;
  delete globalThis.window;
}
