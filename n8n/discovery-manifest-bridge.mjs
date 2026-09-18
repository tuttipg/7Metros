import { validateDiscoveryManifest } from './importer-core.mjs';
import { canonicalizeOfficialFemebalUrl, OFFICIAL_FEMEBAL_URL_POLICY } from './official-url-policy.mjs';

export const DISCOVERY_PDF_TYPES = Object.freeze({
  PROGRAMACION: 'programacion_pdf',
  PLANILLA_PARTIDO: 'planilla_partido_pdf',
});

export function classifyDiscoveryPdf(pdfUrl) {
  const canonical = canonicalizeOfficialFemebalUrl(pdfUrl, { pdf: true });
  const url = new URL(canonical);
  if (url.hostname === OFFICIAL_FEMEBAL_URL_POLICY.planilla_host && url.pathname.startsWith('/pdf_planillas/')) {
    return DISCOVERY_PDF_TYPES.PLANILLA_PARTIDO;
  }
  if ((url.hostname === 'femebal.com' || url.hostname === 'www.femebal.com') && url.pathname.startsWith('/wp-content/uploads/')) {
    return DISCOVERY_PDF_TYPES.PROGRAMACION;
  }
  throw new Error(`PDF oficial sin tipo reconocido: ${canonical}`);
}

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
  const documentType = classifyDiscoveryPdf(pdfUrl);

  // Si un manifest futuro trae el tipo explícito, debe coincidir con la
  // clasificación derivada de la ruta oficial. Así evitamos que metadata
  // manipulada convierta una programación en una planilla procesable.
  if (row.document_type !== undefined && row.document_type !== null) {
    const declared = String(row.document_type).trim();
    if (declared !== documentType) {
      throw new Error(`document_type contradictorio para ${pdfUrl}: ${declared || 'ausente'} != ${documentType}`);
    }
  }

  return {
    page_url: pageUrl,
    page_title: String(row.page_title ?? '').trim() || null,
    pdf_url: pdfUrl,
    anchor_text: String(row.anchor_text ?? '').trim() || null,
    source_type: sourceType,
    phase,
    round_number: roundNumber,
    document_type: documentType,
  };
}

export function buildDiscoveryPdfWorkItems(manifest) {
  validateDiscoveryManifest(manifest);

  const byUrl = new Map();
  for (const row of manifest.pdfs) {
    const source = sourceMetadata(row);

    // Programaciones son evidencia de fixture/fecha/hora. Sólo una planilla
    // individual puede cruzar esta frontera hacia el parser de planillas.
    if (source.document_type !== DISCOVERY_PDF_TYPES.PLANILLA_PARTIDO) continue;

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
