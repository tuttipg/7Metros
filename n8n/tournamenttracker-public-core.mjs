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
  if (url.searchParams.has('noAdv') && !['0', '1'].includes(url.searchParams.get('noAdv'))) {
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
  const url = new URL(String(value ?? ''), base);

  if (url.protocol !== 'https:') throw new Error('Asset TournamentTracker requiere HTTPS');
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error('Host de asset TournamentTracker no permitido');
  if (url.username || url.password) throw new Error('Asset TournamentTracker no admite credenciales en URL');
  if (url.hash) throw new Error('Asset TournamentTracker no admite fragments');
  if (url.search) throw new Error('Asset TournamentTracker no admite query strings');

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

export function extractTournamentTrackerStaticAssetUrls(html, baseUrl = FEMEBAL_TOURNAMENTTRACKER_URL) {
  const text = String(html ?? '');
  const rawCandidates = [];
  const patterns = [
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /<link\b[^>]*\brel\s*=\s*["'](?:modulepreload|preload)["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\brel\s*=\s*["'](?:modulepreload|preload)["'][^>]*>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) rawCandidates.push(match[1]);
  }

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
