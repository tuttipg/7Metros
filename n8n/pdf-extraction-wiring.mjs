import { createHash } from 'node:crypto';
import { normalizePdfProvenance, parseN8nExtractedPlanillaDryRun } from './pdf-extract-contract.mjs';
import { validatePdfWorkItem } from './planilla-dry-run-core.mjs';

const SHA256_RE = /^[0-9a-f]{64}$/;

function stableWorkItemSnapshot(workItem) {
  const url = validatePdfWorkItem(workItem);
  return {
    kind: workItem.kind,
    method: workItem.method,
    url,
    allow_redirects: workItem.allow_redirects,
    auth_used: workItem.auth_used,
    write_enabled: workItem.write_enabled,
  };
}

export function buildPdfExtractionEnvelope({ workItem, pdfArtifact } = {}) {
  const provenance = normalizePdfProvenance(pdfArtifact, workItem);
  if (!(pdfArtifact.bytes instanceof Uint8Array)) {
    throw new Error('Artefacto PDF sin bytes binarios');
  }
  if (pdfArtifact.bytes.byteLength !== provenance.byte_length) {
    throw new Error('byte_length no coincide con bytes del artefacto');
  }
  const recomputedSha256 = createHash('sha256').update(pdfArtifact.bytes).digest('hex');
  if (recomputedSha256 !== provenance.sha256) {
    throw new Error('SHA-256 no coincide con bytes del artefacto');
  }

  return {
    schema_version: 1,
    correlation_id: provenance.sha256,
    dry_run: true,
    write_enabled: false,
    auth_used: false,
    work_item: stableWorkItemSnapshot(workItem),
    provenance: {
      dry_run: true,
      write_enabled: false,
      auth_used: false,
      ...provenance,
    },
  };
}

export function validatePdfExtractionEnvelope(envelope, workItem) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Envelope de extracción ausente o inválido');
  }
  if (envelope.schema_version !== 1) throw new Error('schema_version de envelope inválido');
  if (envelope.dry_run !== true || envelope.write_enabled !== false || envelope.auth_used !== false) {
    throw new Error('Envelope de extracción no es SAFE/DRY RUN');
  }
  const correlationId = String(envelope.correlation_id ?? '').toLowerCase();
  if (!SHA256_RE.test(correlationId)) throw new Error('correlation_id inválido');

  const expectedWorkItem = stableWorkItemSnapshot(workItem);
  const actualWorkItem = envelope.work_item;
  if (!actualWorkItem || typeof actualWorkItem !== 'object') throw new Error('work_item snapshot ausente');
  for (const key of Object.keys(expectedWorkItem)) {
    if (actualWorkItem[key] !== expectedWorkItem[key]) throw new Error(`work_item snapshot no coincide: ${key}`);
  }

  const provenance = normalizePdfProvenance(envelope.provenance, workItem);
  if (provenance.sha256 !== correlationId) throw new Error('correlation_id no coincide con SHA-256 de proveniencia');
  return { correlation_id: correlationId, provenance };
}

export function parseExtractionWithEnvelopeDryRun({ workItem, envelope, extraction, expected = null, maxTextChars } = {}) {
  const validated = validatePdfExtractionEnvelope(envelope, workItem);
  const result = parseN8nExtractedPlanillaDryRun({
    workItem,
    extraction,
    pdfArtifact: {
      dry_run: true,
      write_enabled: false,
      auth_used: false,
      ...validated.provenance,
    },
    expected,
    maxTextChars,
  });
  if (result.provenance.sha256 !== validated.correlation_id || result.extraction.source_sha256 !== validated.correlation_id) {
    throw new Error('Se perdió la correlación SHA-256 durante extracción');
  }
  return {
    ...result,
    correlation_id: validated.correlation_id,
    wiring: {
      mode: 'safe_envelope_rejoin',
      dry_run: true,
      write_enabled: false,
      auth_used: false,
    },
  };
}
