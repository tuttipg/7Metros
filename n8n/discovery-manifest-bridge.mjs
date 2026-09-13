import { validateDiscoveryManifest } from './importer-core.mjs';
import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

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

export function buildDiscoveryPdfWorkItems(manifest) {
  validateDiscoveryManifest(manifest);

  const byUrl = new Map();
  for (const row of manifest.pdfs) {
    const source = sourceMetadata(row);
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
