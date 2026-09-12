import { parseOfficialFemebalSheet } from './planilla-core.mjs';

const ALLOWED_HOSTS = new Set(['femebal.com', 'www.femebal.com']);

export function validatePdfWorkItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Work item PDF inválido');
  }
  if (item.kind !== 'femebal_official_pdf') throw new Error('kind de work item inválido');
  if (item.method !== 'GET') throw new Error('El work item debe usar GET');
  if (item.allow_redirects !== false) throw new Error('Los redirects deben estar deshabilitados');
  if (item.auth_used !== false) throw new Error('El work item no puede usar autenticación');
  if (item.write_enabled !== false) throw new Error('El work item no puede habilitar escritura');

  let url;
  try {
    url = new URL(String(item.url ?? ''));
  } catch {
    throw new Error('URL de planilla inválida');
  }

  if (url.protocol !== 'https:') throw new Error('La planilla debe usar HTTPS');
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error(`Host de planilla fuera de allowlist: ${url.hostname}`);
  if (url.username || url.password) throw new Error('URL de planilla con userinfo rechazada');
  if (url.port && url.port !== '443') throw new Error(`Puerto de planilla fuera de allowlist: ${url.port}`);
  if (url.search || url.hash) throw new Error('URL de planilla con query/fragmento rechazada');
  if (!url.pathname.startsWith('/wp-content/uploads/') || !url.pathname.toLowerCase().endsWith('.pdf')) {
    throw new Error('La planilla debe provenir del árbol oficial de uploads FEMEBAL');
  }

  if (!item.source || item.source.pdf_url !== item.url) {
    throw new Error('La fuente del work item no coincide con su URL');
  }

  return url.toString();
}

function normalizeIdentity(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function assertExpectedMatch(parsed, expected) {
  if (!expected) return;
  if (expected.fecha && parsed.fecha !== expected.fecha) {
    throw new Error(`Fecha inesperada: ${parsed.fecha}`);
  }
  if (expected.local && normalizeIdentity(parsed.local.nombre) !== normalizeIdentity(expected.local)) {
    throw new Error(`Equipo local inesperado: ${parsed.local.nombre}`);
  }
  if (expected.visitante && normalizeIdentity(parsed.visitante.nombre) !== normalizeIdentity(expected.visitante)) {
    throw new Error(`Equipo visitante inesperado: ${parsed.visitante.nombre}`);
  }
  if (expected.goles_local !== undefined && parsed.local.goles !== expected.goles_local) {
    throw new Error(`Marcador local inesperado: ${parsed.local.goles}`);
  }
  if (expected.goles_visitante !== undefined && parsed.visitante.goles !== expected.goles_visitante) {
    throw new Error(`Marcador visitante inesperado: ${parsed.visitante.goles}`);
  }
}

/**
 * Tramo puro del pipeline DRY RUN: recibe un work item ya construido por
 * discovery-manifest-bridge y el texto previamente extraído del PDF.
 * No hace red, no usa credenciales y no persiste datos.
 */
export function parsePlanillaDryRun({ workItem, extractedText, expected = null }) {
  const sourceUrl = validatePdfWorkItem(workItem);
  if (typeof extractedText !== 'string' || !extractedText.trim()) {
    throw new Error('Texto extraído de planilla vacío');
  }

  const parsed = parseOfficialFemebalSheet(extractedText);
  assertExpectedMatch(parsed, expected);

  return {
    dry_run: true,
    write_enabled: false,
    auth_used: false,
    source_url: sourceUrl,
    source: workItem.source,
    parsed,
    validation: {
      player_goal_totals_match_score: true,
      expected_match_checked: Boolean(expected),
    },
  };
}
