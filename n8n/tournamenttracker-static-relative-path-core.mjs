import { createHash } from 'node:crypto';

const MAX_PATH_LENGTH = 1024;
const AMBIGUOUS_RAW_CHARS = /[\\\x00-\x1f\x7f]/;
const STATIC_RESOURCE_EXTENSION = /\.(?:css|gif|ico|jpe?g|js|json|map|mjs|pdf|png|svg|webp|woff2?|ttf|eot)$/i;
const BLOCKED_SEGMENTS = /^(?:admin|auth|create|delete|import|insert|login|logout|mutate|oauth|password|register|remove|reset|session|token|update|upload|write)/i;

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

function classifyRelativePath(raw) {
  if (!raw || raw.length > MAX_PATH_LENGTH) return { accepted: false, reason: 'invalid_length' };
  if (!raw.startsWith('/') || raw.startsWith('//')) return { accepted: false, reason: 'root_relative_path_required' };
  if (AMBIGUOUS_RAW_CHARS.test(raw)) return { accepted: false, reason: 'ambiguous_raw_characters' };
  if (raw.includes('${') || raw.includes('?') || raw.includes('#') || /%[0-9a-f]{2}/i.test(raw)) {
    return { accepted: false, reason: 'dynamic_or_ambiguous_path' };
  }
  if (STATIC_RESOURCE_EXTENSION.test(raw)) return { accepted: false, reason: 'static_resource' };
  const segments = raw.split('/').filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) {
    return { accepted: false, reason: 'invalid_segments' };
  }
  const blocked = segments.find((segment) => BLOCKED_SEGMENTS.test(segment));
  if (blocked) return { accepted: false, reason: `blocked_segment:${blocked}` };
  return { accepted: true, path: raw };
}

export function extractTournamentTrackerStaticRelativePaths({ body, assetClassification } = {}) {
  const text = String(body ?? '');
  if (!bodyMatchesValidatedAsset(text, assetClassification)) {
    return {
      safe: true, dry_run: true, sourceValidated: false, state: 'source_not_validated',
      candidates: [], probeAllowed: false, executionAllowed: false,
    };
  }

  const accepted = new Map();
  let rejectedCount = 0;
  // Static evidence only: standalone root-relative strings. Never resolve them to a host and never request them.
  const literalPattern = /(['"`])(\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@\/-]+)\1/g;
  for (const match of text.matchAll(literalPattern)) {
    const before = text.slice(0, match.index).trimEnd();
    const after = text.slice(match.index + match[0].length).trimStart();
    if (before.endsWith('+') || after.startsWith('+')) {
      rejectedCount += 1;
      continue;
    }
    const classified = classifyRelativePath(match[2]);
    if (!classified.accepted) {
      rejectedCount += 1;
      continue;
    }
    accepted.set(classified.path, {
      path: classified.path,
      evidence: 'standalone_root_relative_string_literal',
      state: 'static_relative_path_evidence_only',
      hostResolved: false,
      probeAllowed: false,
      requiresManualReview: true,
    });
  }

  return {
    safe: true,
    dry_run: true,
    sourceValidated: true,
    state: 'static_relative_path_candidates_only',
    candidates: [...accepted.values()].sort((a, b) => a.path.localeCompare(b.path)),
    rejectedCount,
    probeAllowed: false,
    executionAllowed: false,
    constraints: {
      hostResolutionAllowed: false,
      automaticProbingAllowed: false,
      sourceBodyIntegrityRequired: true,
      concatenationAllowed: false,
      templateEvaluationAllowed: false,
      queryAllowed: false,
      fragmentAllowed: false,
      percentEncodingAllowed: false,
      writesAllowed: false,
      authAllowed: false,
    },
  };
}
