import { createHash } from 'node:crypto';

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
const SENSITIVE_COMPOUND_QUERY_TOKENS = new Set([
  'accesstoken',
  'apikey',
  'auth',
  'authorization',
  'cookie',
  'password',
  'secret',
  'session',
  'token',
]);
const MUTATING_QUERY_KEYS = new Set([
  'create',
  'delete',
  'import',
  'insert',
  'mutate',
  'remove',
  'reset',
  'update',
  'upload',
  'write',
]);
const MUTATING_QUERY_VALUES = new Set([
  'create',
  'delete',
  'import',
  'insert',
  'mutate',
  'remove',
  'reset',
  'update',
  'upload',
  'write',
]);
const OPERATION_QUERY_KEYS = new Set(['action', 'method', 'op', 'operation']);
const OPERATION_COMPOUND_QUERY_TOKENS = new Set(['action', 'method', 'operation']);

const FEMEBAL_HOSTS = new Set(['femebal.com', 'www.femebal.com']);
const SENSITIVE_OR_MUTATING_PATH_SEGMENTS = new Set([
  'admin',
  'auth',
  'create',
  'delete',
  'import',
  'insert',
  'login',
  'logout',
  'mutate',
  'oauth',
  'password',
  'register',
  'remove',
  'reset',
  'session',
  'token',
  'update',
  'upload',
  'write',
]);
const SENSITIVE_PATH_PREFIXES = new Set([
  'admin',
  'auth',
  'login',
  'logout',
  'oauth',
  'password',
  'register',
  'session',
  'token',
]);
const STATIC_RESOURCE_EXTENSION = /\.(?:css|gif|ico|jpe?g|js|json|map|mjs|pdf|png|svg|webp|woff2?|ttf|eot)$/i;
const MAX_EXPLICIT_URL_LENGTH = 2048;
const AMBIGUOUS_RAW_URL_CHARS = /[\\\x00-\x1f\x7f]/;

function compactQueryKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveQueryKey(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (SENSITIVE_QUERY_KEYS.has(normalized)) return true;

  const compact = compactQueryKey(normalized);
  if (!compact) return false;
  return [...SENSITIVE_COMPOUND_QUERY_TOKENS].some((token) => (
    compact === token || compact.startsWith(token) || compact.endsWith(token)
  ));
}

function isMutatingQueryKey(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (MUTATING_QUERY_KEYS.has(normalized)) return true;

  const compact = compactQueryKey(normalized);
  if (!compact) return false;
  return [...MUTATING_QUERY_KEYS].some((operation) => compact.startsWith(operation));
}

function isOperationQueryKey(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (OPERATION_QUERY_KEYS.has(normalized)) return true;

  const compact = compactQueryKey(normalized);
  if (!compact) return false;
  return [...OPERATION_COMPOUND_QUERY_TOKENS].some((token) => (
    compact.startsWith(token) || compact.endsWith(token)
  ));
}

function isMutatingOperationValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return [...MUTATING_QUERY_VALUES].some((operation) => normalized.startsWith(operation));
}

function isSensitiveOrMutatingPathSegment(segment) {
  const normalized = String(segment ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (SENSITIVE_OR_MUTATING_PATH_SEGMENTS.has(normalized)) return true;
  if ([...SENSITIVE_PATH_PREFIXES].some((token) => normalized.startsWith(token))) return true;
  return [...MUTATING_QUERY_VALUES].some((operation) => normalized.startsWith(operation));
}

function classifyExplicitHttpsLiteral(rawValue) {
  const raw = String(rawValue ?? '');
  if (!raw || raw.length > MAX_EXPLICIT_URL_LENGTH) return { accepted: false, reason: 'invalid_length' };
  if (AMBIGUOUS_RAW_URL_CHARS.test(raw)) return { accepted: false, reason: 'ambiguous_raw_url_characters' };
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
  if (url.port && url.port !== '443') return { accepted: false, reason: 'nonstandard_https_port' };
  if (/%[0-9a-f]{2}/i.test(url.pathname)) return { accepted: false, reason: 'percent_encoded_path_not_allowed' };

  for (const [rawKey, rawQueryValue] of url.searchParams.entries()) {
    const key = rawKey.toLowerCase();
    const queryValue = rawQueryValue.trim().toLowerCase();
    if (isSensitiveQueryKey(key)) {
      return { accepted: false, reason: 'sensitive_query_key' };
    }
    if (isMutatingQueryKey(key)) {
      return { accepted: false, reason: 'mutating_query_key' };
    }
    if (isOperationQueryKey(key) && isMutatingOperationValue(queryValue)) {
      return { accepted: false, reason: 'mutating_query_operation' };
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

function bodyMatchesValidatedAsset(text, assetClassification) {
  if (!assetClassification || typeof assetClassification !== 'object') return false;
  const bodyBytes = new TextEncoder().encode(text).byteLength;
  const bodySha256 = createHash('sha256').update(text, 'utf8').digest('hex');
  const expectedSha256 = String(assetClassification.bodySha256 ?? '').toLowerCase();

  return assetClassification.state === 'public_static_javascript'
    && assetClassification.analyzableStaticJavascript === true
    && assetClassification.analysisMode === 'static_text_only'
    && assetClassification.executionAllowed === false
    && Number.isSafeInteger(assetClassification.bodyBytes)
    && assetClassification.bodyBytes === bodyBytes
    && /^[0-9a-f]{64}$/.test(expectedSha256)
    && expectedSha256 === bodySha256;
}

function isConcatenatedLiteral(text, matchIndex, matchLength) {
  const before = text.slice(0, matchIndex).trimEnd();
  const after = text.slice(matchIndex + matchLength).trimStart();
  return before.endsWith('+') || after.startsWith('+');
}

function extractionResultIsPolicyEligible(extractionResult) {
  return extractionResult
    && typeof extractionResult === 'object'
    && extractionResult.safe === true
    && extractionResult.dry_run === true
    && extractionResult.sourceValidated === true
    && extractionResult.state === 'static_candidates_only'
    && extractionResult.probeAllowed === false
    && extractionResult.executionAllowed === false
    && extractionResult.constraints?.automaticProbingAllowed === false
    && extractionResult.constraints?.sourceBodyIntegrityRequired === true
    && Array.isArray(extractionResult.candidates);
}

function classifyCandidateForPolicy(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return { state: 'invalid_candidate', probeAllowed: false, anonymousGetReviewable: false };
  }
  if (candidate.evidence !== 'explicit_https_string_literal'
      || candidate.probeAllowed !== false
      || candidate.requiresPolicyReview !== true) {
    return { state: 'invalid_candidate_contract', probeAllowed: false, anonymousGetReviewable: false };
  }

  const classified = classifyExplicitHttpsLiteral(candidate.url);
  if (!classified.accepted) {
    return {
      url: String(candidate.url ?? ''),
      state: 'rejected_on_policy_revalidation',
      reason: classified.reason,
      probeAllowed: false,
      anonymousGetReviewable: false,
    };
  }

  if (classified.hostScope !== 'femebal_same_organization') {
    return {
      url: classified.url,
      state: 'external_untrusted',
      hostScope: classified.hostScope,
      probeAllowed: false,
      anonymousGetReviewable: false,
      manualReviewRequired: true,
    };
  }

  const url = new URL(classified.url);
  const pathSegments = url.pathname.toLowerCase().split('/').filter(Boolean);
  const sensitiveSegment = pathSegments.find(isSensitiveOrMutatingPathSegment);
  if (sensitiveSegment) {
    return {
      url: classified.url,
      state: 'blocked_sensitive_or_mutating_path',
      hostScope: classified.hostScope,
      reason: `blocked_path_segment:${sensitiveSegment}`,
      probeAllowed: false,
      anonymousGetReviewable: false,
      manualReviewRequired: true,
    };
  }

  if (STATIC_RESOURCE_EXTENSION.test(url.pathname)) {
    return {
      url: classified.url,
      state: 'static_resource_not_endpoint',
      hostScope: classified.hostScope,
      probeAllowed: false,
      anonymousGetReviewable: false,
      manualReviewRequired: true,
    };
  }

  return {
    url: classified.url,
    state: 'femebal_public_get_reviewable',
    hostScope: classified.hostScope,
    probeAllowed: false,
    anonymousGetReviewable: true,
    manualReviewRequired: true,
    allowedMethodIfReviewed: 'GET',
    authAllowed: false,
    writesAllowed: false,
  };
}

export function extractTournamentTrackerExplicitHttpsCandidates({ body, assetClassification } = {}) {
  const text = String(body ?? '');
  const sourceValidated = bodyMatchesValidatedAsset(text, assetClassification);

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

  const accepted = new Map();
  let rejectedCount = 0;

  // Deliberately conservative: only complete HTTPS URLs inside one standalone plain JS string literal.
  // No relative-path resolution, concatenation, deobfuscation, template evaluation or JS execution.
  const literalPattern = /(['"`])(https:\/\/[^'"`\\\s]+)\1/g;
  for (const match of text.matchAll(literalPattern)) {
    if (isConcatenatedLiteral(text, match.index, match[0].length)) {
      rejectedCount += 1;
      continue;
    }

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
      sourceBodyIntegrityRequired: true,
      percentEncodedPathsAllowed: false,
      nonstandardHttpsPortsAllowed: false,
      ambiguousRawUrlCharactersAllowed: false,
      mutatingQuerySemanticsAllowed: false,
      compoundSensitiveQueryKeysAllowed: false,
      compoundMutatingQueryKeysAllowed: false,
      compoundOperationQueryKeysAllowed: false,
    },
  };
}

export function classifyTournamentTrackerCandidatePolicy(extractionResult) {
  if (!extractionResultIsPolicyEligible(extractionResult)) {
    return {
      safe: true,
      dry_run: true,
      state: 'source_extraction_not_policy_eligible',
      candidates: [],
      probeAllowed: false,
      automaticProbingAllowed: false,
      writesAllowed: false,
      authAllowed: false,
    };
  }

  return {
    safe: true,
    dry_run: true,
    state: 'policy_classified_candidates',
    candidates: extractionResult.candidates.map(classifyCandidateForPolicy),
    probeAllowed: false,
    automaticProbingAllowed: false,
    writesAllowed: false,
    authAllowed: false,
    constraints: {
      onlyExplicitHttpsLiterals: true,
      femebalSameOrganizationOnlyForReviewableGet: true,
      sensitiveOrMutatingPathsBlocked: true,
      compoundSensitivePathPrefixesBlocked: true,
      compoundMutatingPathPrefixesBlocked: true,
      sensitiveOrMutatingQueriesBlocked: true,
      compoundSensitiveQueryKeysBlocked: true,
      compoundMutatingQueryKeysBlocked: true,
      compoundOperationQueryKeysBlocked: true,
      externalHostsBlocked: true,
      staticResourcesBlockedAsEndpoints: true,
      percentEncodedPathsBlocked: true,
      nonstandardHttpsPortsBlocked: true,
      ambiguousRawUrlCharactersBlocked: true,
      manualReviewRequiredBeforeAnyGet: true,
    },
  };
}
