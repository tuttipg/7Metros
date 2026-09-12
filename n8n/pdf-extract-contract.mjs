import { parsePlanillaDryRun } from './planilla-dry-run-core.mjs';

const DEFAULT_MAX_TEXT_CHARS = 2_000_000;
const SHA256_RE = /^[0-9a-f]{64}$/;

export function normalizeN8nPdfExtraction(extraction, { maxTextChars = DEFAULT_MAX_TEXT_CHARS } = {}) {
  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    throw new Error('Salida Extract From File inválida');
  }
  if (!Number.isInteger(maxTextChars) || maxTextChars < 1_000) {
    throw new Error('maxTextChars inválido');
  }

  const text = extraction.text;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Extract From File no devolvió texto PDF utilizable');
  }
  if (text.length > maxTextChars) {
    throw new Error(`Texto PDF excede límite de ${maxTextChars} caracteres`);
  }

  const pageCountRaw = extraction.numpages ?? extraction.numPages ?? extraction.pages ?? null;
  let pageCount = null;
  if (pageCountRaw !== null && pageCountRaw !== undefined && pageCountRaw !== '') {
    pageCount = Number(pageCountRaw);
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      throw new Error('Cantidad de páginas PDF inválida');
    }
  }

  return {
    dry_run: true,
    write_enabled: false,
    auth_used: false,
    extracted_text: text,
    page_count: pageCount,
  };
}

export function normalizePdfProvenance(pdfArtifact, workItem) {
  if (!pdfArtifact || typeof pdfArtifact !== 'object' || Array.isArray(pdfArtifact)) {
    throw new Error('Proveniencia PDF ausente o inválida');
  }
  if (pdfArtifact.dry_run !== true || pdfArtifact.write_enabled !== false || pdfArtifact.auth_used !== false) {
    throw new Error('Proveniencia PDF no es SAFE/DRY RUN');
  }
  const sourceUrl = String(pdfArtifact.source_url ?? '');
  if (!sourceUrl || sourceUrl !== workItem?.url) {
    throw new Error('source_url de proveniencia no coincide con work item');
  }
  const contentType = String(pdfArtifact.content_type ?? '').toLowerCase();
  if (!contentType.startsWith('application/pdf')) {
    throw new Error('Content-Type de proveniencia PDF inválido');
  }
  const byteLength = Number(pdfArtifact.byte_length);
  if (!Number.isInteger(byteLength) || byteLength < 5) {
    throw new Error('byte_length de proveniencia PDF inválido');
  }
  const sha256 = String(pdfArtifact.sha256 ?? '').toLowerCase();
  if (!SHA256_RE.test(sha256)) {
    throw new Error('SHA-256 de proveniencia PDF inválido');
  }

  return {
    source_url: sourceUrl,
    content_type: contentType,
    byte_length: byteLength,
    sha256,
  };
}

export function parseN8nExtractedPlanillaDryRun({ workItem, extraction, pdfArtifact, expected = null, maxTextChars } = {}) {
  const normalized = normalizeN8nPdfExtraction(extraction, { maxTextChars });
  const provenance = normalizePdfProvenance(pdfArtifact, workItem);
  const result = parsePlanillaDryRun({
    workItem,
    extractedText: normalized.extracted_text,
    expected,
  });

  return {
    ...result,
    provenance,
    extraction: {
      engine: 'n8n_extract_from_file_pdf',
      page_count: normalized.page_count,
      text_chars: normalized.extracted_text.length,
      source_sha256: provenance.sha256,
    },
  };
}
