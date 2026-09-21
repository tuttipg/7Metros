const FEMEBAL_HOSTS = new Set(['femebal.com', 'www.femebal.com']);
const PUBLIC_INDEX_HOSTS = new Set(['google.com', 'www.google.com', 'bing.com', 'www.bing.com']);
const MAX_ROUTE_TOKEN_LENGTH = 256;
const INDEXED_ROUTE_PREFIX = '/tournament-tracker/';
const PUBLIC_EVIDENCE_KINDS = new Set(['public_index', 'explicit_public_link']);
const SENSITIVE_QUERY_NAMES = new Set(['auth', 'authorization', 'bearer', 'cookie', 'credential', 'credentials', 'csrf', 'jwt', 'key', 'password', 'secret', 'session', 'token', 'xsrf']);
const SENSITIVE_QUERY_NAME_PARTS = ['apikey', 'accesskey', 'accesstoken', 'authtoken', 'clientkey', 'clientsecret', 'credential', 'privatekey', 'secretkey', 'sessionid', 'signingkey', 'token'];

function rejectAmbiguousRawUrl(value, label) {
  const raw = String(value ?? '');
  if (raw.includes('\\') || /[\u0000-\u001F\u007F]/.test(raw)) {
    throw new Error(`${label} contiene backslash o caracteres de control ambiguos`);
  }
  return raw;
}

function normalizeQueryName(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function rejectSensitiveQueryNames(url, label) {
  for (const name of url.searchParams.keys()) {
    const normalized = normalizeQueryName(name);
    if (!normalized) continue;
    if (SENSITIVE_QUERY_NAMES.has(normalized) || SENSITIVE_QUERY_NAME_PARTS.some((part) => normalized.includes(part))) {
      throw new Error(`${label} no admite nombres de query sensibles`);
    }
  }
}

function decodeSinglePathSegment(rawSegment) {
  const raw = String(rawSegment ?? '');
  if (!raw || raw.length > MAX_ROUTE_TOKEN_LENGTH * 3) throw new Error('Token TournamentTracker vacío o demasiado largo');
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { throw new Error('Token TournamentTracker con percent-encoding inválido'); }
  if (!decoded || decoded.length > MAX_ROUTE_TOKEN_LENGTH) throw new Error('Token TournamentTracker vacío o demasiado largo');
  if (decoded.includes('/') || decoded.includes('\\') || decoded.includes('.') || decoded.includes('%')) throw new Error('Token TournamentTracker contiene separadores o caracteres ambiguos');
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(decoded)) throw new Error('Formato de token TournamentTracker no permitido');
  return decoded;
}

function validatePublicIndexSource(sourceUrl) {
  if (sourceUrl.pathname !== '/search') throw new Error('La evidencia public_index requiere una página de búsqueda explícita');
  const query = sourceUrl.searchParams.get('q');
  if (!query) throw new Error('La evidencia public_index requiere una consulta de búsqueda explícita');
  const normalizedQuery = query.toLowerCase();
  if (!normalizedQuery.includes('femebal') || !normalizedQuery.includes('tournament-tracker')) throw new Error('La consulta public_index debe referenciar FEMEBAL TournamentTracker');
}

function validateExplicitPublicLinkSource(sourceUrl, targetCanonicalUrl) {
  if (sourceUrl.pathname.startsWith(INDEXED_ROUTE_PREFIX)) throw new Error('La evidencia explicit_public_link no puede usar TournamentTracker como fuente circular');
  if (sourceUrl.toString() === targetCanonicalUrl) throw new Error('La evidencia explicit_public_link no puede ser la propia ruta objetivo');
}

function validatePublicEvidence(targetCanonicalUrl, evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('La evidencia pública debe ser un objeto estructurado');
  const kind = String(evidence.kind ?? '');
  if (!PUBLIC_EVIDENCE_KINDS.has(kind)) throw new Error('Tipo de evidencia pública no permitido');
  const observedUrl = canonicalizeIndexedTournamentTrackerRoute(evidence.observedUrl);
  if (observedUrl !== targetCanonicalUrl) throw new Error('La evidencia pública no corresponde a la ruta solicitada');

  const rawSourceUrl = rejectAmbiguousRawUrl(evidence.sourceUrl, 'La fuente de evidencia pública');
  const sourceUrl = new URL(rawSourceUrl);
  if (sourceUrl.protocol !== 'https:') throw new Error('La fuente de evidencia pública requiere HTTPS');
  if (sourceUrl.port && sourceUrl.port !== '443') throw new Error('La fuente de evidencia pública no admite puertos HTTPS no estándar');
  if (sourceUrl.username || sourceUrl.password) throw new Error('La fuente de evidencia pública no admite credenciales en URL');
  if (sourceUrl.hash) throw new Error('La fuente de evidencia pública no admite fragments');
  rejectSensitiveQueryNames(sourceUrl, 'La fuente de evidencia pública');

  const sourceHost = sourceUrl.hostname.toLowerCase();
  if (kind === 'public_index') {
    if (!PUBLIC_INDEX_HOSTS.has(sourceHost)) throw new Error('La evidencia public_index requiere una fuente de índice público permitida');
    validatePublicIndexSource(sourceUrl);
  }
  if (kind === 'explicit_public_link') {
    if (!FEMEBAL_HOSTS.has(sourceHost)) throw new Error('La evidencia explicit_public_link requiere una fuente oficial FEMEBAL');
    validateExplicitPublicLinkSource(sourceUrl, targetCanonicalUrl);
  }
  return { kind, observedUrl, sourceUrl: sourceUrl.toString() };
}

export function canonicalizeIndexedTournamentTrackerRoute(value) {
  const rawUrl = rejectAmbiguousRawUrl(value, 'Ruta TournamentTracker');
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('Ruta indexada TournamentTracker requiere HTTPS');
  if (url.port && url.port !== '443') throw new Error('Ruta TournamentTracker no admite puertos HTTPS no estándar');
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
    return { safe: true, dry_run: true, state: 'public_indexed_route_reviewable', url, methodIfReviewed: 'GET', authAllowed: false, writesAllowed: false, automaticProbeAllowed: false, sourceRequirement: 'public_index_or_explicit_public_link' };
  } catch (error) {
    return { safe: true, dry_run: true, state: 'rejected_indexed_route', reason: error instanceof Error ? error.message : String(error), authAllowed: false, writesAllowed: false, automaticProbeAllowed: false };
  }
}

export function buildReviewedIndexedTournamentTrackerGet(value, { publicEvidence = null } = {}) {
  const classified = classifyIndexedTournamentTrackerRoute(value);
  if (classified.state !== 'public_indexed_route_reviewable') return { safe: true, dry_run: true, state: 'probe_not_authorized', probe: null, reason: classified.reason, automaticProbeAllowed: false, writesAllowed: false, authAllowed: false };
  let evidence;
  try { evidence = validatePublicEvidence(classified.url, publicEvidence); }
  catch (error) { return { safe: true, dry_run: true, state: 'probe_not_authorized', probe: null, reason: error instanceof Error ? error.message : String(error), automaticProbeAllowed: false, writesAllowed: false, authAllowed: false }; }
  return { safe: true, dry_run: true, state: 'reviewed_anonymous_get_only', evidence, probe: { method: 'GET', url: classified.url, headers: { Accept: 'text/html,application/xhtml+xml' }, auth: false, writes: false }, automaticProbeAllowed: false, writesAllowed: false, authAllowed: false };
}
