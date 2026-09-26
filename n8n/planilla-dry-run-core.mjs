import { parseOfficialFemebalSheet } from './planilla-core.mjs';
import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

export function validatePdfWorkItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Work item PDF inválido');
  if (item.kind !== 'femebal_official_pdf') throw new Error('kind de work item inválido');
  if (item.method !== 'GET') throw new Error('El work item debe usar GET');
  if (item.allow_redirects !== false) throw new Error('Los redirects deben estar deshabilitados');
  if (item.auth_used !== false) throw new Error('El work item no puede usar autenticación');
  if (item.write_enabled !== false) throw new Error('El work item no puede habilitar escritura');

  const sourceUrl = canonicalizeOfficialFemebalUrl(item.url, { pdf: true });
  if (!item.source || typeof item.source !== 'object' || Array.isArray(item.source)) throw new Error('Fuente del work item inválida');
  const sourcePdfUrl = canonicalizeOfficialFemebalUrl(item.source.pdf_url, { pdf: true });
  if (sourcePdfUrl !== sourceUrl) throw new Error('La fuente del work item no coincide con su URL');
  if (item.source.provenance !== 'public_explicit_link') throw new Error('La planilla requiere provenance=public_explicit_link');
  if (item.source.document_type !== 'planilla_partido_pdf') throw new Error('La fuente debe ser document_type=planilla_partido_pdf');
  canonicalizeOfficialFemebalUrl(item.source.page_url);
  if (!['fecha_normal', 'reprogramacion'].includes(item.source.source_type)) throw new Error('source_type de la planilla inválido');
  return sourceUrl;
}

function normalizeIdentity(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function assertExpectedMatch(parsed, expected) {
  if (expected === null || expected === undefined) return false;
  if (typeof expected !== 'object' || Array.isArray(expected)) throw new Error('Identidad esperada inválida');
  if (expected.fecha !== undefined) {
    if (typeof expected.fecha !== 'string') throw new Error('Fecha esperada inválida');
    if (parsed.fecha !== expected.fecha) throw new Error(`Fecha inesperada: ${parsed.fecha}`);
  }
  if (expected.local !== undefined) {
    if (typeof expected.local !== 'string' || !expected.local.trim()) throw new Error('Equipo local esperado inválido');
    if (normalizeIdentity(parsed.local.nombre) !== normalizeIdentity(expected.local)) throw new Error(`Equipo local inesperado: ${parsed.local.nombre}`);
  }
  if (expected.visitante !== undefined) {
    if (typeof expected.visitante !== 'string' || !expected.visitante.trim()) throw new Error('Equipo visitante esperado inválido');
    if (normalizeIdentity(parsed.visitante.nombre) !== normalizeIdentity(expected.visitante)) throw new Error(`Equipo visitante inesperado: ${parsed.visitante.nombre}`);
  }
  if (expected.goles_local !== undefined) {
    if (!Number.isSafeInteger(expected.goles_local) || expected.goles_local < 0) throw new Error('Marcador local esperado inválido');
    if (parsed.local.goles !== expected.goles_local) throw new Error(`Marcador local inesperado: ${parsed.local.goles}`);
  }
  if (expected.goles_visitante !== undefined) {
    if (!Number.isSafeInteger(expected.goles_visitante) || expected.goles_visitante < 0) throw new Error('Marcador visitante esperado inválido');
    if (parsed.visitante.goles !== expected.goles_visitante) throw new Error(`Marcador visitante inesperado: ${parsed.visitante.goles}`);
  }
  return typeof expected.fecha === 'string' && expected.fecha.length > 0
    && typeof expected.local === 'string' && expected.local.trim().length > 0
    && typeof expected.visitante === 'string' && expected.visitante.trim().length > 0
    && Number.isSafeInteger(expected.goles_local) && expected.goles_local >= 0
    && Number.isSafeInteger(expected.goles_visitante) && expected.goles_visitante >= 0;
}

export function parsePlanillaDryRun({ workItem, extractedText, expected = null }) {
  const sourceUrl = validatePdfWorkItem(workItem);
  if (typeof extractedText !== 'string' || !extractedText.trim()) throw new Error('Texto extraído de planilla vacío');
  const parsed = parseOfficialFemebalSheet(extractedText);
  const expectedMatchChecked = assertExpectedMatch(parsed, expected);
  const expectedMatchEvidence = expectedMatchChecked ? {
    fecha: expected.fecha,
    local: expected.local.trim(),
    visitante: expected.visitante.trim(),
    goles_local: expected.goles_local,
    goles_visitante: expected.goles_visitante,
  } : null;
  return {
    dry_run: true,
    write_enabled: false,
    auth_used: false,
    source_url: sourceUrl,
    source: { ...workItem.source, pdf_url: sourceUrl },
    parsed,
    validation: {
      player_goal_totals_match_score: true,
      expected_match_checked: expectedMatchChecked,
      expected_match_evidence: expectedMatchEvidence,
    },
  };
}
