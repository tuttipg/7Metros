import { parsePlanillaDryRun } from './planilla-dry-run-core.mjs';

const DEFAULT_MAX_TEXT_CHARS = 2_000_000;

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

export function parseN8nExtractedPlanillaDryRun({ workItem, extraction, expected = null, maxTextChars } = {}) {
  const normalized = normalizeN8nPdfExtraction(extraction, { maxTextChars });
  const result = parsePlanillaDryRun({
    workItem,
    extractedText: normalized.extracted_text,
    expected,
  });

  return {
    ...result,
    extraction: {
      engine: 'n8n_extract_from_file_pdf',
      page_count: normalized.page_count,
      text_chars: normalized.extracted_text.length,
    },
  };
}
