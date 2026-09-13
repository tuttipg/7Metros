export const FEMEBAL_TOURNAMENTTRACKER_URL = 'https://www.femebal.com/tournament-tracker/?noAdv=0';

const ALLOWED_HOSTS = new Set(['femebal.com', 'www.femebal.com']);

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
