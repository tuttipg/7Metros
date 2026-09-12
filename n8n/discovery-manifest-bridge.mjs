import { validateDiscoveryManifest } from './importer-core.mjs';

const ALLOWED_HOSTS = new Set(['femebal.com', 'www.femebal.com']);

function parseOfficialHttpsUrl(value, { pdf = false } = {}) {
  let url;
  try {
    url = new URL(String(value ?? ''));
  } catch {
    throw new Error('URL FEMEBAL inválida');
  }

  if (url.protocol !== 'https:') throw new Error('URL FEMEBAL debe usar HTTPS');
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error(`Host FEMEBAL fuera de allowlist: ${url.hostname}`);
  if (url.username || url.password) throw new Error('URL FEMEBAL con userinfo rechazada');
  if (url.port && url.port !== '443') throw new Error(`Puerto FEMEBAL fuera de allowlist: ${url.port}`);
  if (url.hash) throw new Error('URL FEMEBAL con fragmento rechazada');

  if (pdf) {
    if (!url.pathname.startsWith('/wp-content/uploads/')) {
      throw new Error('PDF fuera del árbol oficial de uploads');
    }
    if (!url.pathname.toLowerCase().endsWith('.pdf')) {
      throw new Error('Adjunto FEMEBAL no es PDF');
    }
    if (url.search) throw new Error('PDF FEMEBAL con query string rechazada');
  }

  return url.toString();
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

  const pageUrl = parseOfficialHttpsUrl(row.page_url);
  const pdfUrl = parseOfficialHttpsUrl(row.pdf_url, { pdf: true });

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

/**
 * Convierte un manifest SAFE ya validado en unidades explícitas para un nodo
 * posterior de n8n. Esta función es pura: no descarga PDFs, no usa credenciales
 * y no habilita escrituras.
 *
 * El contrato de salida fija GET + no auth + no write + redirects deshabilitados.
 * Si el mismo PDF aparece con metadatos contradictorios, falla cerrado.
 */
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
