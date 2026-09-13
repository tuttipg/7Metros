const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'apikey',
  'api_key',
  'auth',
  'authorization',
  'cookie',
  'key',
  'password',
  'secret',
  'session',
  'token',
]);

const FEMEBAL_HOSTS = new Set(['femebal.com', 'www.femebal.com']);
const MAX_EXPLICIT_URL_LENGTH = 2048;

function classifyExplicitHttpsLiteral(rawValue) {
  const raw = String(rawValue ?? '');
  if (!raw || raw.length > MAX_EXPLICIT_URL_LENGTH) return { accepted: false, reason: 'invalid_length' };
  if (raw.includes('${')) return { accepted: false, reason: 'template_interpolation' };

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { accepted: false, reason: 'invalid_url' };
  }

  if (url.protocol !== 'https:') return { accepted: false, reason: 'https_required' };
  if (url.username || url.password) return { accepted: false, reason: 'embedded_credentials' };
  if (url.hash) return { accepted: false, reason: 'fragment_not_allowed' };
  if (!url.hostname || url.pathname === '/') return { accepted: false, reason: 'non_endpoint_root_url' };

  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      return { accepted: false, reason: 'sensitive_query_key' };
    }
  }

  url.hostname = url.hostname.toLowerCase();
  if (url.port === '443') url.port = '';

  return {
    accepted: true,
    url: url.toString(),
    hostScope: FEMEBAL_HOSTS.has(url.hostname) ? 'femebal_same_organization' : 'external_untrusted',
  };
}

export function extractTournamentTrackerExplicitHttpsCandidates({ body, assetClassification } = {}) {
  const sourceValidated = Boolean(
    assetClassification
      && assetClassification.analyzableStaticJavascript === true
      && assetClassification.analysisMode === 'static_text_only'
      && assetClassification.executionAllowed === false,
  );

  if (!sourceValidated) {
    return {
      safe: true,
      dry_run: true,
      sourceValidated: false,
      candidates: [],
      rejectedCount: 0,
      probeAllowed: false,
      executionAllowed: false,
      state: 'source_not_validated',
    };
  }

  const text = String(body ?? '');
  const accepted = new Map();
  let rejectedCount = 0;

  // Deliberately conservative: only complete HTTPS URLs inside one plain JS string literal.
  // No relative-path resolution, concatenation, deobfuscation, template evaluation or JS execution.
  const literalPattern = /(['"`])(https:\/\/[^'"`\\\s]+)\1/g;
  for (const match of text.matchAll(literalPattern)) {
    const classified = classifyExplicitHttpsLiteral(match[2]);
    if (!classified.accepted) {
      rejectedCount += 1;
      continue;
    }
    accepted.set(classified.url, {
      url: classified.url,
      hostScope: classified.hostScope,
      evidence: 'explicit_https_string_literal',
      probeAllowed: false,
      requiresPolicyReview: true,
    });
  }

  return {
    safe: true,
    dry_run: true,
    sourceValidated: true,
    candidates: [...accepted.values()].sort((a, b) => a.url.localeCompare(b.url)),
    rejectedCount,
    probeAllowed: false,
    executionAllowed: false,
    state: 'static_candidates_only',
    constraints: {
      relativeResolutionAllowed: false,
      concatenationAllowed: false,
      templateEvaluationAllowed: false,
      deobfuscationAllowed: false,
      javascriptExecutionAllowed: false,
      automaticProbingAllowed: false,
    },
  };
}
