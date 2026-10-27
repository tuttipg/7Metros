const FEMEBAL_WEB_HOSTS = new Set(['femebal.com', 'www.femebal.com']);
const FEMEBAL_PLANILLA_HOST = 'djfhz848yeeat.cloudfront.net';
const TRACKING_QUERY_KEYS = new Set(['fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid']);
const SENSITIVE_QUERY_KEYS = new Set([
  'auth',
  'authorization',
  'bearer',
  'cookie',
  'credential',
  'credentials',
  'csrf',
  'xsrf',
  'jwt',
  'key',
  'password',
  'secret',
  'session',
  'token',
]);
const SENSITIVE_QUERY_COMPOUND_TOKENS = [
  'accesskey',
  'accesskeyid',
  'accesstoken',
  'apikey',
  'auth',
  'authkey',
  'authorization',
  'authtoken',
  'bearer',
  'clientkey',
  'clientsecret',
  'cookie',
  'credential',
  'credentials',
  'csrf',
  'jwt',
  'passphrase',
  'password',
  'privatekey',
  'secret',
  'secretkey',
  'session',
  'sessionid',
  'signature',
  'signingkey',
  'token',
  'xsrf',
];

function rawPathFromHttpsUrl(value) {
  const raw = String(value ?? '');
  const match = raw.match(/^https:\/\/[^/?#]+([^?#]*)/i);
  return match ? (match[1] || '/') : '';
}

function hasAmbiguousRawPath(value) {
  const rawPath = rawPathFromHttpsUrl(value);
  return !rawPath || rawPath.includes('%') || rawPath.split('/').some((segment) => segment === '.' || segment === '..');
}

function assertUnambiguousRawHttpsInput(raw) {
  if(/[\\\u0000-\u001f\u007f]/.test(raw)) {
    throw new Error('URL FEMEBAL con caracteres ambiguos/normalizables rechazada');
  }
}

function hasTrackingQuery(url) {
  for (const [key] of url.searchParams) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('utm_') || TRACKING_QUERY_KEYS.has(normalized)) return true;
  }
  return false;
}

function hasSensitiveQuery(url) {
  for (const [key] of url.searchParams) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SENSITIVE_QUERY_KEYS.has(normalized) || SENSITIVE_QUERY_COMPOUND_TOKENS.some((token) => (
      normalized === token || normalized.startsWith(token) || normalized.endsWith(token)
    ))) {
      return true;
    }
  }
  return false;
}

export function canonicalizeOfficialFemebalUrl(value, { pdf = false } = {}) {
  const raw = String(value ?? '');
  assertUnambiguousRawHttpsInput(raw);

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL FEMEBAL inválida');
  }

  if (url.protocol !== 'https:') throw new Error('URL FEMEBAL debe usar HTTPS');
  const hostAllowed = FEMEBAL_WEB_HOSTS.has(url.hostname) || (pdf && url.hostname === FEMEBAL_PLANILLA_HOST);
  if (!hostAllowed) throw new Error(`Host FEMEBAL fuera de allowlist: ${url.hostname}`);
  if (url.username || url.password) throw new Error('URL FEMEBAL con userinfo rechazada');
  if (url.port && url.port !== '443') throw new Error(`Puerto FEMEBAL fuera de allowlist: ${url.port}`);
  if (url.hash) throw new Error('URL FEMEBAL con fragmento rechazada');

  if (!pdf) {
    if (hasAmbiguousRawPath(raw)) throw new Error('URL FEMEBAL con path ambiguo/normalizable rechazado');
    if (hasTrackingQuery(url)) throw new Error('URL FEMEBAL con tracking query rechazada');
    if (hasSensitiveQuery(url)) throw new Error('URL FEMEBAL con query sensible rechazada');
    return url.toString();
  }

  if (url.search) throw new Error('PDF FEMEBAL con query string rechazada');

  // Keep parity with the Python discovery: official PDFs observed by 7Metros use
  // plain path segments. Reject encoded and dot-segment spellings before URL()
  // normalization can turn two raw inputs into a misleadingly equivalent path.
  if (hasAmbiguousRawPath(raw)) {
    throw new Error('PDF FEMEBAL con path ambiguo/normalizable rechazado');
  }

  const wordpressPdf = FEMEBAL_WEB_HOSTS.has(url.hostname) && url.pathname.startsWith('/wp-content/uploads/');
  const planillaPdf = url.hostname === FEMEBAL_PLANILLA_HOST && url.pathname.startsWith('/pdf_planillas/');
  if (!wordpressPdf && !planillaPdf) throw new Error('PDF fuera de los árboles oficiales permitidos');
  if (!url.pathname.toLowerCase().endsWith('.pdf')) throw new Error('Adjunto FEMEBAL no es PDF');

  // One identity for equivalent default-port spellings, matching Python discovery.
  return `https://${url.hostname}${url.pathname}`;
}

export const OFFICIAL_FEMEBAL_URL_POLICY = Object.freeze({
  web_hosts: Object.freeze([...FEMEBAL_WEB_HOSTS]),
  planilla_host: FEMEBAL_PLANILLA_HOST,
  pdf_paths: Object.freeze(['/wp-content/uploads/', '/pdf_planillas/']),
  tracking_query_keys: Object.freeze([...TRACKING_QUERY_KEYS]),
  sensitive_query_keys: Object.freeze([...SENSITIVE_QUERY_KEYS]),
});
