import { validateDiscoveryManifest } from './importer-core.mjs';
import { canonicalizeOfficialFemebalUrl, OFFICIAL_FEMEBAL_URL_POLICY } from './official-url-policy.mjs';

function sourceMetadata(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('Entrada PDF inválida');
  }

  const sourceType = String(row.source_type ?? '').trim();
  if (!['fecha_normal', 'reprogramacion'].includes(sourceType)) {
    throw new Error(`source_type inválido: ${sourceType || 'ausente'}`);
  }

  let phase = row.phase ?? null;
  if (phase !== null) {
    phase = String(phase).trim().toLowerCase();
    if (!['apertura', 'clausura'].includes(phase)) throw new Error(`phase inválida: ${phase}`);
  }

  let roundNumber = row.round_number ?? null;
  if (roundNumber !== null) {
    roundNumber = Number(roundNumber);
    if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 99) {
      throw new Error(`round_number inválido: ${row.round_number}`);
    }
  }

  const pageUrl = canonicalizeOfficialFemebalUrl(row.page_url);
  const pdfUrl = canonicalizeOfficialFemebalUrl(row.pdf_url, { pdf: true });

  return {
    page_url: pageUrl,
    page_title: String(row.page_title ?? '').trim() || null,
    pdf_url: pdfUrl,
    anchor_text: String(row.anchor_text ?? '').trim() || null,
    source_type: sourceType,
    phase,
    round_number: roundNumber,
  };
}

function isOfficialMatchSheetPdf(pdfUrl) {
  const url = new URL(pdfUrl);
  return url.hostname === OFFICIAL_FEMEBAL_URL_POLICY.planilla_host && url.pathname.startsWith('/pdf_planillas/');
}

export function buildDiscoveryPdfWorkItems(manifest) {
  validateDiscoveryManifest(manifest);

  const byUrl = new Map();
  for (const row of manifest.pdfs) {
    const source = sourceMetadata(row);

    // Programaciones publicadas bajo wp-content/uploads son evidencia de fixture,
    // fecha y hora, pero NO una planilla individual de partido. El bridge hacia
    // el parser de planillas solo puede emitir PDFs del árbol oficial /pdf_planillas/.
    if (!isOfficialMatchSheetPdf(source.pdf_url)) continue;

    const previous = byUrl.get(source.pdf_url);

    if (previous) {
      const same = JSON.stringify(previous.source) === JSON.stringify(source);
      if (!same) throw new Error(`PDF con metadatos contradictorios: ${source.pdf_url}`);
      continue;
    }

    byUrl.set(source.pdf_url, {
      kind: 'femebal_official_pdf',
      method: 'GET',
      url: source.pdf_url,
      allow_redirects: false,
      auth_used: false,
      write_enabled: false,
      source,
    });
  }

  return [...byUrl.values()];
}
