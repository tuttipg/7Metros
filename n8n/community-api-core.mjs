export const COMMUNITY_API_BASE = 'https://api.cam.larrysport.tecdata.net';
export const COMMUNITY_APP_VARIANT = 'cah';
export const COMMUNITY_USER_AGENT = 'FemebalCommunity/1.0.13';

export function communityHeaders() {
  return {
    Accept: 'application/json',
    'User-Agent': COMMUNITY_USER_AGENT,
    'X-App-Variant': COMMUNITY_APP_VARIANT
  };
}

export function buildCommunityProbePlan() {
  return [
    { key: 'team_categories', method: 'GET', path: '/teams/categories', expectation: 'public_reference' },
    { key: 'news', method: 'GET', path: '/news/list', expectation: 'public_reference' },
    { key: 'tournaments', method: 'GET', path: '/tournaments?offset=0&pagination%5BpageSize%5D=100', expectation: 'discovery' },
    { key: 'matches', method: 'GET', path: '/matches?offset=0&pagination%5BpageSize%5D=200', expectation: 'protected_or_public' },
    { key: 'search_ferro', method: 'GET', path: '/search?offset=0&q=Ferro', expectation: 'discovery' }
  ].map(probe => ({
    ...probe,
    url: `${COMMUNITY_API_BASE}${probe.path}`,
    headers: communityHeaders()
  }));
}

function parseBody(body) {
  if (body == null) return { text: '', json: null };
  if (typeof body === 'object') {
    try {
      return { text: JSON.stringify(body), json: body };
    } catch {
      return { text: String(body), json: null };
    }
  }
  const text = String(body).trim();
  if (!text) return { text, json: null };
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

export function classifyCommunityResponse({ statusCode, body }) {
  const status = Number.isFinite(Number(statusCode)) ? Number(statusCode) : null;
  const { text, json } = parseBody(body);
  const sample = text.slice(0, 2000);

  const authMessage = /unauthori|forbidden|missing authorization|missing token|authentication required|access token|invalid token|jwt/i.test(sample);
  const notFoundMessage = /cannot get|not found/i.test(sample);

  // El status HTTP manda sobre palabras accidentales del payload. Un 2xx público puede
  // contener términos como "token" o "JWT" en noticias/configuración y no debe
  // reclasificarse como protegido. Sólo 401/403 (o un 400 explícitamente de auth)
  // se consideran evidencia suficiente para marcar la ruta fuera de alcance.
  let state = 'transport_or_server_error';
  if (status === 401 || status === 403) state = 'auth_required';
  else if (status === 404 || (status == null && notFoundMessage)) state = 'not_found';
  else if (status != null && status >= 200 && status < 300 && json !== null) state = 'public_json';
  else if (status != null && status >= 200 && status < 300) state = 'public_non_json';
  else if (status === 400 && authMessage) state = 'auth_required';

  return {
    state,
    statusCode: status,
    jsonValid: json !== null,
    json,
    bodySize: text.length,
    sample
  };
}

export function summarizeCommunityDiscovery(results) {
  if (!Array.isArray(results)) throw new Error('results debe ser un array');

  const normalized = results.map(result => ({
    key: String(result?.key ?? ''),
    path: String(result?.path ?? ''),
    ...classifyCommunityResponse(result)
  }));

  const matches = normalized.find(item => item.key === 'matches' || /^\/matches(?:\?|$)/.test(item.path));
  const publicJson = normalized.filter(item => item.state === 'public_json');
  const authRequired = normalized.filter(item => item.state === 'auth_required');

  let nextStep = 'discover_public_routes';
  if (matches?.state === 'auth_required') nextStep = 'skip_protected_matches_expand_public_routes';
  else if (matches?.state === 'public_json') nextStep = 'extract_match_filters_and_ids';
  else if (authRequired.length) nextStep = 'skip_protected_routes_expand_public_routes';
  else if (publicJson.length) nextStep = 'expand_public_route_discovery';

  return {
    publicJson: publicJson.map(item => item.path),
    authRequired: authRequired.map(item => item.path),
    notFound: normalized.filter(item => item.state === 'not_found').map(item => item.path),
    nextStep,
    constraints: {
      publicEndpointDoesNotImplyMatchesArePublic: Boolean(publicJson.length && matches?.state === 'auth_required'),
      protectedRoutesOutOfScope: authRequired.map(item => item.path),
      authDiscoveryEnabled: false,
      firebaseAuthValidated: false
    },
    results: normalized.map(({ json, ...item }) => item)
  };
}
