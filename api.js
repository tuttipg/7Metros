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

  // Fallback útil para mocks o instalaciones que no devuelven Content-Range.
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

export async function loadPublicDataset(seasonId) {
  const season = Number(seasonId);

  // Equipos es la primera consulta porque define el alcance real de la temporada.
  const equipos = await supabaseGetAll(
    'equipos',
    `?select=id,club_id,temporada_id,categoria,division,rama,equipo_codigo,nombre_femebal,activo&temporada_id=eq.${season}`
  );

  const teamIds = equipos.map(row => Number(row.id)).filter(Number.isFinite);
  const clubIds = equipos.map(row => Number(row.club_id)).filter(Number.isFinite);

  const [clubes, planteles, totalClubes, totalJugadores] = await Promise.all([
    supabaseGetByIds('clubes', 'id', clubIds, 'id,nombre,abreviatura,ciudad,logo_url'),
    supabaseGetByIds('planteles', 'equipo_id', teamIds, 'id,jugador_id,equipo_id,dorsal,posicion'),
    supabaseCount('clubes'),
    supabaseCount('jugadores')
  ]);

  const playerIds = planteles.map(row => Number(row.jugador_id)).filter(Number.isFinite);

  // Partidos se pagina. La portada usa además totales globales, por eso esta consulta
  // conserva el alcance completo y el store filtra luego la temporada mediante equipos.
  const [jugadores, partidos, participaciones] = await Promise.all([
    supabaseGetByIds('jugadores', 'id', playerIds, 'id,nombre,apellido,fecha_nacimiento,brazo_habil,altura_cm,peso_kg'),
    supabaseGetAll('partidos', '?select=*'),
    supabaseGetByIds('participaciones', 'equipo_id', teamIds, '*')
  ]);

  const finalizadosGlobales = partidos.filter(row => {
    const estado = String(row.estado || '').toLowerCase();
    const tieneResultado = row.goles_local !== null && row.goles_local !== undefined && row.goles_visitante !== null && row.goles_visitante !== undefined;
    return estado === 'finalizado' || estado === 'final' || (tieneResultado && estado !== 'programado');
  });
  const golesGlobales = finalizadosGlobales.reduce((sum, row) =>
    sum + Number(row.goles_local || 0) + Number(row.goles_visitante || 0), 0
  );

  const globalSummary = {
    clubs: totalClubes,
    players: totalJugadores,
    matches: partidos.length,
    finished: finalizadosGlobales.length,
    goals: golesGlobales,
    avgGoals: finalizadosGlobales.length ? Number((golesGlobales / finalizadosGlobales.length).toFixed(1)) : null
  };

  return { clubes, equipos, jugadores, planteles, partidos, participaciones, globalSummary };
}
