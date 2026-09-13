export const FEMEBAL_TOURNAMENTTRACKER_URL = 'https://www.femebal.com/tournament-tracker/?noAdv=0';

const ALLOWED_HOSTS = new Set(['femebal.com', 'www.femebal.com']);
const STATIC_ASSET_EXTENSIONS = new Set(['.js', '.mjs']);

export function canonicalizeFemebalTournamentTrackerUrl(value) {
  const url = new URL(String(value ?? ''));
  if (url.protocol !== 'https:') throw new Error('TournamentTracker requiere HTTPS');
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error('Host TournamentTracker no permitido');
  if (url.username || url.password) throw new Error('TournamentTracker no admite credenciales en URL');
  if (url.hash) throw new Error('TournamentTracker no admite fragments');
  if (url.pathname !== '/tournament-tracker/' && url.pathname !== '/tournament-tracker') {
    throw new Error('Ruta TournamentTracker no permitida');
  }

  const allowedParams = new Set(['noAdv']);
  for (const key of url.searchParams.keys()) {
    if (!allowedParams.has(key)) throw new Error(`Query TournamentTracker no permitida: ${key}`);
  }
  const noAdvValues = url.searchParams.getAll('noAdv');
  if (noAdvValues.length > 1) throw new Error('Query noAdv duplicada o ambigua');
  if (noAdvValues.length === 1 && !['0', '1'].includes(noAdvValues[0])) {
    throw new Error('Valor noAdv no permitido');
  }

  url.hostname = 'www.femebal.com';
  url.port = '';
  url.pathname = '/tournament-tracker/';
  url.searchParams.sort();
  return url.toString();
}

export function canonicalizeTournamentTrackerStaticAssetUrl(value, baseUrl = FEMEBAL_TOURNAMENTTRACKER_URL) {
  const base = canonicalizeFemebalTournamentTrackerUrl(baseUrl);
  const rawValue = String(value ?? '');
  const url = new URL(rawValue, base);

  if (url.protocol !== 'https:') throw new Error('Asset TournamentTracker requiere HTTPS');
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error('Host de asset TournamentTracker no permitido');
  if (url.username || url.password) throw new Error('Asset TournamentTracker no admite credenciales en URL');
  if (url.hash) throw new Error('Asset TournamentTracker no admite fragments');
  if (url.search) throw new Error('Asset TournamentTracker no admite query strings');
  if (/%[0-9a-f]{2}/i.test(url.pathname) || /%[0-9a-f]{2}/i.test(rawValue)) {
    throw new Error('Asset TournamentTracker no admite path percent-encoded');
  }

  const lowerPath = url.pathname.toLowerCase();
  const extension = [...STATIC_ASSET_EXTENSIONS].find((ext) => lowerPath.endsWith(ext));
  if (!extension) throw new Error('Tipo de asset TournamentTracker no permitido');
  if (!lowerPath.startsWith('/tournament-tracker/')) {
    throw new Error('Ruta de asset TournamentTracker fuera del prefijo permitido');
  }

  url.hostname = 'www.femebal.com';
  url.port = '';
  return url.toString();
}

function parseHtmlTagAttributes(tag) {
  const attrs = new Map();
  const attrPattern = /\b([a-zA-Z_:][\w:.-]*)\s*=\s*(?:["']([^"']*)["']|([^\s>]+))/g;
  for (const match of String(tag ?? '').matchAll(attrPattern)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? '';
    if (!attrs.has(key)) attrs.set(key, value);
  }
  return attrs;
}

function collectTournamentTrackerAssetCandidates(html) {
  const text = String(html ?? '');
  const candidates = [];

  for (const match of text.matchAll(/<script\b[^>]*>/gi)) {
    const attrs = parseHtmlTagAttributes(match[0]);
    const src = attrs.get('src');
    if (src) candidates.push(src);
  }

  for (const match of text.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseHtmlTagAttributes(match[0]);
    const href = attrs.get('href');
    if (!href) continue;

    const relTokens = String(attrs.get('rel') ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const asValue = String(attrs.get('as') ?? '').toLowerCase();
    const isModulePreload = relTokens.includes('modulepreload');
    const isScriptPreload = relTokens.includes('preload') && asValue === 'script';
    if (isModulePreload || isScriptPreload) candidates.push(href);
  }

  return candidates;
}

export function extractTournamentTrackerStaticAssetUrls(html, baseUrl = FEMEBAL_TOURNAMENTTRACKER_URL) {
  const rawCandidates = collectTournamentTrackerAssetCandidates(html);
  const accepted = [];
  const rejected = [];

  for (const candidate of rawCandidates) {
    try {
      accepted.push(canonicalizeTournamentTrackerStaticAssetUrl(candidate, baseUrl));
    } catch (error) {
      rejected.push({
        candidate,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    assets: [...new Set(accepted)].sort(),
    rejected,
  };
}

export function buildTournamentTrackerStaticAssetProbePlan(html, baseUrl = FEMEBAL_TOURNAMENTTRACKER_URL) {
  const extracted = extractTournamentTrackerStaticAssetUrls(html, baseUrl);
  return {
    safe: true,
    dry_run: true,
    write_enabled: false,
    auth_used: false,
    probes: extracted.assets.map((url, index) => ({
      key: `femebal_tournament_tracker_static_js_${index + 1}`,
      method: 'GET',
      url,
      headers: { Accept: 'application/javascript,text/javascript,*/*;q=0.1' },
      auth: false,
      writes: false,
    })),
    rejected: extracted.rejected,
    constraints: {
      credentialsAllowed: false,
      cookiesAllowed: false,
      authorizationAllowed: false,
      productionWritesAllowed: false,
      executableEvaluationAllowed: false,
      javascriptStaticTextOnly: true,
    },
  };
}

export function buildTournamentTrackerPublicProbePlan() {
  return [{
    key: 'femebal_tournament_tracker_shell',
    method: 'GET',
    url: FEMEBAL_TOURNAMENTTRACKER_URL,
    headers: { Accept: 'text/html,application/xhtml+xml' },
    auth: false,
    writes: false,
  }];
}

export function classifyTournamentTrackerPublicResponse({ statusCode, body, finalUrl = FEMEBAL_TOURNAMENTTRACKER_URL }) {
  const status = Number.isFinite(Number(statusCode)) ? Number(statusCode) : null;
  let canonicalFinalUrl = null;
  try {
    canonicalFinalUrl = canonicalizeFemebalTournamentTrackerUrl(finalUrl);
  } catch {
    return {
      state: 'unsafe_redirect_or_url',
      statusCode: status,
      publicSpaShell: false,
      canonicalFinalUrl: null,
    };
  }

  const text = String(body ?? '');
  const spaShell = /enable javascript to run this app/i.test(text)
    || /<div[^>]+id=["']root["']/i.test(text)
    || /<script[^>]+(?:src=|type=["']module["'])/i.test(text);

  let state = 'transport_or_server_error';
  if (status === 401 || status === 403) state = 'auth_required';
  else if (status === 404) state = 'not_found';
  else if (status != null && status >= 200 && status < 300 && spaShell) state = 'public_spa_shell';
  else if (status != null && status >= 200 && status < 300) state = 'public_html_unclassified';

  return {
    state,
    statusCode: status,
    publicSpaShell: state === 'public_spa_shell',
    canonicalFinalUrl,
    bodySize: text.length,
    sample: text.slice(0, 1000),
  };
}

export function summarizeTournamentTrackerPublicDiscovery(response) {
  const classified = classifyTournamentTrackerPublicResponse(response);
  return {
    safe: true,
    dry_run: true,
    write_enabled: false,
    auth_used: false,
    surface: classified,
    next_step: classified.state === 'public_spa_shell'
      ? 'static_asset_analysis_only'
      : classified.state === 'auth_required'
        ? 'stop_protected_surface'
        : 'revalidate_public_surface',
    constraints: {
      credentialsAllowed: false,
      cookiesAllowed: false,
      authorizationAllowed: false,
      productionWritesAllowed: false,
      staticAssetsOnlyUntilPublicEndpointsVerified: true,
    },
  };
}
