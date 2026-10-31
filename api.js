import { CONFIG } from './config.js';

const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT = 15000;
const SESSION_CACHE_VERSION = 'public-v1';
const SESSION_CACHE_TTL = 2 * 60 * 1000;
const SESSION_CACHE_MAX_CHARS = 3_500_000;

function sessionStore() {
  try { return globalThis.sessionStorage || null; } catch { return null; }
}

function datasetCacheKey(season) {
  return `7m:dataset:${SESSION_CACHE_VERSION}:${season}`;
}

function readDatasetCache(season) {
  const store = sessionStore();
  if (!store) return null;
  const key = datasetCacheKey(season);
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedAt = parsed?.at;
    const age = Date.now() - cachedAt;
    // Un reloj adelantado o una marca corrupta no deben extender el TTL indefinidamente.
    if (!Number.isSafeInteger(cachedAt) || cachedAt <= 0 ||
        age < 0 || age > SESSION_CACHE_TTL || !parsed?.dataset) {
      store.removeItem(key);
      return null;
    }
    return parsed.dataset;
  } catch {
    try { store.removeItem(key); } catch {}
    return null;
  }
}

function writeDatasetCache(season, dataset) {
  const store = sessionStore();
  if (!store) return;
  const key = datasetCacheKey(season);
  try {
    const raw = JSON.stringify({ at: Date.now(), dataset });
    if (raw.length > SESSION_CACHE_MAX_CHARS) return;
    store.setItem(key, raw);
  } catch {
    try { store.removeItem(key); } catch {}
  }
}

export class DataError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'DataError';
    this.cause = cause;
  }
}

export function validatePublicConfig(config = CONFIG) {
  const base = String(config?.supabaseUrl || '').trim().replace(/\/$/, '');
  const key = String(config?.supabaseKey || '').trim();

  if (!base) throw new DataError('Falta configurar la URL pública de Supabase.');

  let parsed;
  try {
    parsed = new URL(base);
  } catch (error) {
    throw new DataError('La URL pública de Supabase no es válida.', error);
  }

  if (parsed.protocol !== 'https:') {
    throw new DataError('La URL pública de Supabase debe usar HTTPS.');
  }

  if (!/\.supabase\.co$/i.test(parsed.hostname) && !/\.test$/i.test(parsed.hostname)) {
    throw new DataError('La URL pública configurada no corresponde a un endpoint esperado de Supabase.');
  }

  if (!key) throw new DataError('Falta configurar la clave pública de Supabase.');

  return { base, key };
}

function endpoint(table, query = '') {
  const { base } = validatePublicConfig();
  const suffix = query ? (String(query).startsWith('?') ? query : `?${query}`) : '';
  return `${base}/rest/v1/${table}${suffix}`;
}

function headers(range = null, extra = {}) {
  const { key } = validatePublicConfig();
  const result = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  if (range) result.Range = range;
  return { ...result, ...extra };
}

async function request(url, options = {}, consume = response => response) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const failure = new DataError(`Error ${response.status} al consultar datos. ${detail}`.trim());
      // Preserve PostgREST code to distinguish missing legacy schema from 5xx/paused service.
      try {
        const payload = JSON.parse(detail);
        if (typeof payload?.code === 'string') failure.code = payload.code;
      } catch {
        // A non-JSON error must never authorize a full-table fallback.
      }
      throw failure;
    }
    // Keep the deadline active while reading the body, not only the headers.
    return await consume(response);
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new DataError('La consulta de datos excedió el tiempo de espera.', error);
    }
    if (error instanceof DataError) throw error;
    throw new DataError('No se pudo conectar con la fuente de datos.', error);
  } finally {
    clearTimeout(timer);
  }
}

export async function supabaseGetAll(table, query = '', { pageSize = PAGE_SIZE } = {}) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const page = await request(endpoint(table, query), {
      method: 'GET',
      headers: headers(`${from}-${to}`)
    }, response => response.json());
    if (!Array.isArray(page)) throw new DataError(`Respuesta inesperada al consultar ${table}.`);
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
    if (from > 100000) throw new DataError(`La consulta de ${table} superó el límite de seguridad.`);
  }

  return rows;
}

export async function supabaseCount(table) {
  return request(endpoint(table, '?select=id'), {
    method: 'GET',
    headers: headers('0-0', { Prefer: 'count=exact' })
  }, response => {
    const contentRange = response.headers.get('content-range') || '';
    const match = contentRange.match(/\/(\d+)$/);
    // A one-row range is not a total. Never publish an estimated count.
    if (!match) throw new DataError(`Conteo exacto no disponible para ${table}.`);
    const count = Number(match[1]);
    if (!Number.isSafeInteger(count)) {
      throw new DataError(`Conteo exacto inválido para ${table}.`);
    }
    return count;
  });
}

export async function supabaseGetByIds(
  table,
  field,
  ids,
  select = '*',
  { chunkSize = 100, concurrency = 4 } = {}
) {
  // IDs externos pueden contener null, strings vacíos o enteros fuera de rango.
  // Number(...) los convierte silenciosamente en 0 o redondea valores grandes.
  const values = [...new Set((ids || []).map(value => {
    if (typeof value === 'number') {
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    }
    if (typeof value === 'string' && /^[1-9]\\d*$/.test(value)) {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    }
    return null;
  }).filter(value => value !== null))];
  if (!values.length) return [];
  if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 500) {
    throw new DataError('El tamaño de bloque para IDs no es válido.');
  }
  if (!Number.isInteger(concurrency) || concurrency <= 0 || concurrency > 6) {
    throw new DataError('La concurrencia de lectura no es válida.');
  }

  const chunks = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }

  const result = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const pages = await Promise.all(batch.map(chunk => {
      const query = `?select=${encodeURIComponent(select)}&${encodeURIComponent(field)}=in.(${chunk.join(',')})`;
      return supabaseGetAll(table, query);
    }));
    pages.forEach(page => result.push(...page));
  }
  return result;
}

function summaryFromMatches(matches, clubs, players) {
  const finalizados = matches.filter(row => {
    const estado = String(row.estado || '').toLowerCase();
    const tieneResultado = row.goles_local !== null && row.goles_local !== undefined
      && row.goles_visitante !== null && row.goles_visitante !== undefined;
    return estado === 'finalizado' || estado === 'final' || (tieneResultado && estado !== 'programado');
  });
  const goals = finalizados.reduce((sum, row) =>
    sum + Number(row.goles_local || 0) + Number(row.goles_visitante || 0), 0
  );
  return {
    clubs,
    players,
    matches: matches.length,
    finished: finalizados.length,
    goals,
    avgGoals: finalizados.length ? Number((goals / finalizados.length).toFixed(1)) : null
  };
}

let globalSummaryPromise = null;

function isMissingGlobalSummaryView(error) {
  return error instanceof DataError
    && (error.code === '42P01' || error.code === 'PGRST205')
    && /\bv_global_summary\b/i.test(error.message);
}

async function loadGlobalSummaryView() {
  try {
    const rows = await supabaseGetAll(
      'v_global_summary',
      '?select=clubes,jugadores,partidos,partidos_con_resultado,goles,promedio_goles'
    );
    const row = rows[0];
    // An empty but existing view is not proof that the view is absent.
    // Fail closed rather than scanning every match through the legacy fallback.
    if (!row) throw new DataError('La vista de resumen global no devolvió filas.');
    return {
      clubs: Number(row.clubes || 0),
      players: Number(row.jugadores || 0),
      matches: Number(row.partidos || 0),
      finished: Number(row.partidos_con_resultado || 0),
      goals: Number(row.goles || 0),
      avgGoals: row.promedio_goles === null || row.promedio_goles === undefined
        ? null
        : Number(row.promedio_goles)
    };
  } catch (error) {
    if (!isMissingGlobalSummaryView(error)) throw error;
    // Only an absent legacy view authorizes the expensive global fallback.
    return null;
  }
}

export function loadGlobalSummaryFast() {
  if (!globalSummaryPromise) {
    globalSummaryPromise = loadGlobalSummaryView().catch(error => {
      // Do not retain a transient failure for the rest of the session.
      globalSummaryPromise = null;
      throw error;
    });
  }
  return globalSummaryPromise;
}

export function filterMatchesToTeamIds(matches, teamIds) {
  const allowed = teamIds instanceof Set
    ? teamIds
    : new Set((teamIds || []).map(Number).filter(Number.isFinite));

  return (matches || []).filter(row => {
    const homeTeamId = Number(row?.local_equipo_id ?? row?.local_id);
    const awayTeamId = Number(row?.visitante_equipo_id ?? row?.visitante_id);
    return Number.isFinite(homeTeamId)
      && Number.isFinite(awayTeamId)
      && allowed.has(homeTeamId)
      && allowed.has(awayTeamId);
  });
}

export function filterParticipationsToMatches(participations, matches) {
  const teamsByMatch = new Map();
  for (const row of matches || []) {
    const matchId = Number(row?.id);
    const homeTeamId = Number(row?.local_equipo_id ?? row?.local_id);
    const awayTeamId = Number(row?.visitante_equipo_id ?? row?.visitante_id);
    if (!Number.isFinite(matchId) || !Number.isFinite(homeTeamId) || !Number.isFinite(awayTeamId)) continue;
    teamsByMatch.set(matchId, new Set([homeTeamId, awayTeamId]));
  }

  return (participations || []).filter(row => {
    const matchId = Number(row?.partido_id);
    const teamId = Number(row?.equipo_id);
    const matchTeams = teamsByMatch.get(matchId);
    return Number.isFinite(matchId)
      && Number.isFinite(teamId)
      && Boolean(matchTeams?.has(teamId));
  });
}

function isMissingSeasonColumn(error) {
  return error instanceof DataError
    && error.code === '42703'
    && /\btemporada_id\b/i.test(error.message);
}

async function loadSeasonMatches(season, teamIds) {
  let rows;
  try {
    rows = await supabaseGetAll('partidos', `?select=*&temporada_id=eq.${season}`);
  } catch (error) {
    if (!isMissingSeasonColumn(error)) throw error;
    // Legacy schema only: keep both teams scoped to the requested season.
    rows = await supabaseGetAll('partidos', '?select=*');
  }
  return filterMatchesToTeamIds(rows, teamIds);
}

export async function loadPublicDataset(seasonId) {
  const season = Number(seasonId);
  if (!Number.isInteger(season) || season <= 0) throw new DataError('La temporada configurada no es válida.');

  const cached = readDatasetCache(season);
  if (cached) return cached;

  // Arranca el resumen global en paralelo para que Inicio pueda mostrar escala
  // de la base mientras todavía se cargan los datos detallados de la temporada.
  // Attach rejection handling immediately; the summary may fail before teams load.
  const summaryViewOutcome = loadGlobalSummaryFast().then(
    value => ({ value }),
    error => ({ error })
  );

  const rawEquipos = await supabaseGetAll(
    'equipos',
    `?select=id,club_id,temporada_id,categoria,division,rama,equipo_codigo,nombre_femebal,activo&temporada_id=eq.${season}`
  );

  const scopedEquipos = rawEquipos.filter(row =>
    Number.isFinite(Number(row.id)) &&
    Number.isFinite(Number(row.club_id)) &&
    Number.isFinite(Number(row.temporada_id)) &&
    Number(row.temporada_id) === season
  );
  const requestedClubIds = scopedEquipos.map(row => Number(row.club_id));

  const [clubes, summaryOutcome] = await Promise.all([
    supabaseGetByIds('clubes', 'id', requestedClubIds, 'id,nombre,abreviatura,ciudad,logo_url'),
    summaryViewOutcome
  ]);
  if (summaryOutcome.error) throw summaryOutcome.error;
  const summaryView = summaryOutcome.value;

  const validClubIds = new Set(clubes.map(row => Number(row.id)).filter(Number.isFinite));
  const equipos = scopedEquipos.filter(row => validClubIds.has(Number(row.club_id)));
  const teamIds = equipos.map(row => Number(row.id));

  const [planteles, partidos, rawParticipaciones] = await Promise.all([
    supabaseGetByIds(
      'planteles',
      'equipo_id',
      teamIds,
      'id,jugador_id,equipo_id,dorsal,posicion'
    ),
    loadSeasonMatches(season, teamIds),
    supabaseGetByIds('participaciones', 'equipo_id', teamIds, '*')
  ]);
  const playerIds = planteles.map(row => Number(row.jugador_id)).filter(Number.isFinite);
  const jugadores = await supabaseGetByIds(
    'jugadores',
    'id',
    playerIds,
    'id,nombre,apellido,fecha_nacimiento,brazo_habil,altura_cm,peso_kg'
  );
  const participaciones = filterParticipationsToMatches(rawParticipaciones, partidos);

  let globalSummary = summaryView;
  if (!globalSummary) {
    const [totalClubes, totalJugadores, globalMatches] = await Promise.all([
      supabaseCount('clubes'),
      supabaseCount('jugadores'),
      supabaseGetAll('partidos', '?select=*')
    ]);
    globalSummary = summaryFromMatches(globalMatches, totalClubes, totalJugadores);
  }

  const dataset = { clubes, equipos, jugadores, planteles, partidos, participaciones, globalSummary };
  writeDatasetCache(season, dataset);
  return dataset;
}
