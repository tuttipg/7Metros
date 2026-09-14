const FEMEBAL_HOSTS = new Set(['femebal.com', 'www.femebal.com']);
const MAX_ROUTE_TOKEN_LENGTH = 256;
const INDEXED_ROUTE_PREFIX = '/tournament-tracker/';

function decodeSinglePathSegment(rawSegment) {
  const raw = String(rawSegment ?? '');
  if (!raw || raw.length > MAX_ROUTE_TOKEN_LENGTH * 3) {
    throw new Error('Token TournamentTracker vacío o demasiado largo');
  }

  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new Error('Token TournamentTracker con percent-encoding inválido');
  }

  if (!decoded || decoded.length > MAX_ROUTE_TOKEN_LENGTH) {
    throw new Error('Token TournamentTracker vacío o demasiado largo');
  }
  if (decoded.includes('/') || decoded.includes('\\') || decoded.includes('.') || decoded.includes('%')) {
    throw new Error('Token TournamentTracker contiene separadores o caracteres ambiguos');
  }
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(decoded)) {
    throw new Error('Formato de token TournamentTracker no permitido');
  }

  return decoded;
}

export function canonicalizeIndexedTournamentTrackerRoute(value) {
  const url = new URL(String(value ?? ''));
  if (url.protocol !== 'https:') throw new Error('Ruta indexada TournamentTracker requiere HTTPS');
  if (!FEMEBAL_HOSTS.has(url.hostname.toLowerCase())) throw new Error('Host TournamentTracker no permitido');
  if (url.username || url.password) throw new Error('Ruta TournamentTracker no admite credenciales en URL');
  if (url.hash) throw new Error('Ruta TournamentTracker no admite fragments');
  if (url.search) throw new Error('Ruta indexada TournamentTracker no admite query strings');
  if (!url.pathname.startsWith(INDEXED_ROUTE_PREFIX)) throw new Error('Prefijo TournamentTracker no permitido');

  const rawTail = url.pathname.slice(INDEXED_ROUTE_PREFIX.length);
  if (!rawTail || rawTail.includes('/')) throw new Error('Ruta TournamentTracker debe tener un único token');
  const token = decodeSinglePathSegment(rawTail);

  url.hostname = 'www.femebal.com';
  url.port = '';
  url.pathname = `${INDEXED_ROUTE_PREFIX}${token}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function classifyIndexedTournamentTrackerRoute(value) {
  try {
    const url = canonicalizeIndexedTournamentTrackerRoute(value);
    return {
      safe: true,
      dry_run: true,
      state: 'public_indexed_route_reviewable',
      url,
      methodIfReviewed: 'GET',
      authAllowed: false,
      writesAllowed: false,
      automaticProbeAllowed: false,
      sourceRequirement: 'public_index_or_explicit_public_link',
    };
  } catch (error) {
    return {
      safe: true,
      dry_run: true,
      state: 'rejected_indexed_route',
      reason: error instanceof Error ? error.message : String(error),
      authAllowed: false,
      writesAllowed: false,
      automaticProbeAllowed: false,
    };
  }
}

export function buildReviewedIndexedTournamentTrackerGet(value, { publicEvidence = false } = {}) {
  const classified = classifyIndexedTournamentTrackerRoute(value);
  if (classified.state !== 'public_indexed_route_reviewable' || publicEvidence !== true) {
    return {
      safe: true,
      dry_run: true,
      state: 'probe_not_authorized',
      probe: null,
      reason: publicEvidence === true ? classified.reason : 'Falta evidencia pública explícita de la ruta',
      automaticProbeAllowed: false,
      writesAllowed: false,
      authAllowed: false,
    };
  }

  return {
    safe: true,
    dry_run: true,
    state: 'reviewed_anonymous_get_only',
    probe: {
      method: 'GET',
      url: classified.url,
      headers: { Accept: 'text/html,application/xhtml+xml' },
      auth: false,
      writes: false,
    },
    automaticProbeAllowed: false,
    writesAllowed: false,
    authAllowed: false,
  };
}
