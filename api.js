import { CONFIG } from './config.js';

const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT = 15000;

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

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new DataError(`Error ${response.status} al consultar datos. ${detail}`.trim());
    }
    return response;
  } catch (error) {
    if (error?.name === 'AbortError') throw new DataError('La consulta de datos excedió el tiempo de espera.', error);
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
    const response = await request(endpoint(table, query), {
      method: 'GET',
      headers: headers(`${from}-${to}`)
    });
    const page = await response.json();
    if (!Array.isArray(page)) throw new DataError(`Respuesta inesperada al consultar ${table}.`);
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
    if (from > 100000) throw new DataError(`La consulta de ${table} superó el límite de seguridad.`);
  }

  return rows;
}

export async function supabaseCount(table) {
  const response = await request(endpoint(table, '?select=id'), {
    method: 'GET',
    headers: headers('0-0', { Prefer: 'count=exact' })
  });

  const contentRange = response.headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  if (match) return Number(match[1]);

  const page = await response.json();
  return Array.isArray(page) ? page.length : 0;
}

export async function supabaseGetByIds(table, field, ids, select = '*', { chunkSize = 100 } = {}) {
  const values = [...new Set((ids || []).map(Number).filter(Number.isFinite))];
  if (!values.length) return [];

  const result = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const query = `?select=${encodeURIComponent(select)}&${encodeURIComponent(field)}=in.(${chunk.join(',')})`;
    result.push(...await supabaseGetAll(table, query));
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

async function loadGlobalSummaryView() {
  try {
    const rows = await supabaseGetAll(
      'v_global_summary',
      '?select=clubes,jugadores,partidos,partidos_con_resultado,goles,promedio_goles'
    );
    const row = rows[0];
    if (!row) return null;
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
  } catch {
    // Compatibilidad con instalaciones anteriores a v_global_summary.
    return null;
  }
}

async function loadSeasonMatches(season) {
  try {
    return await supabaseGetAll('partidos', `?select=*&temporada_id=eq.${season}`);
  } catch {
    // Fallback para esquemas antiguos: el store descarta cruces fuera del catálogo
    // de equipos de la temporada, por lo que sigue siendo correcto aunque sea menos eficiente.
    return supabaseGetAll('partidos', '?select=*');
  }
}

export async function loadPublicDataset(seasonId) {
  const season = Number(seasonId);
  if (!Number.isInteger(season) || season <= 0) throw new DataError('La temporada configurada no es válida.');

  const equipos = await supabaseGetAll(
    'equipos',
    `?select=id,club_id,temporada_id,categoria,division,rama,equipo_codigo,nombre_femebal,activo&temporada_id=eq.${season}`
  );

  const teamIds = equipos.map(row => Number(row.id)).filter(Number.isFinite);
  const clubIds = equipos.map(row => Number(row.club_id)).filter(Number.isFinite);

  const [clubes, planteles, summaryView] = await Promise.all([
    supabaseGetByIds('clubes', 'id', clubIds, 'id,nombre,abreviatura,ciudad,logo_url'),
    supabaseGetByIds('planteles', 'equipo_id', teamIds, 'id,jugador_id,equipo_id,dorsal,posicion'),
    loadGlobalSummaryView()
  ]);

  const playerIds = planteles.map(row => Number(row.jugador_id)).filter(Number.isFinite);

  const [jugadores, partidos, participaciones] = await Promise.all([
    supabaseGetByIds('jugadores', 'id', playerIds, 'id,nombre,apellido,fecha_nacimiento,brazo_habil,altura_cm,peso_kg'),
    loadSeasonMatches(season),
    supabaseGetByIds('participaciones', 'equipo_id', teamIds, '*')
  ]);

  let globalSummary = summaryView;
  if (!globalSummary) {
    const [totalClubes, totalJugadores, globalMatches] = await Promise.all([
      supabaseCount('clubes'),
      supabaseCount('jugadores'),
      supabaseGetAll('partidos', '?select=*')
    ]);
    globalSummary = summaryFromMatches(globalMatches, totalClubes, totalJugadores);
  }

  return { clubes, equipos, jugadores, planteles, partidos, participaciones, globalSummary };
}
