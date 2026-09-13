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
  return sourceUrl;
}

function normalizeIdentity(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function assertExpectedMatch(parsed, expected) {
  if (!expected) return;
  if (expected.fecha && parsed.fecha !== expected.fecha) throw new Error(`Fecha inesperada: ${parsed.fecha}`);
  if (expected.local && normalizeIdentity(parsed.local.nombre) !== normalizeIdentity(expected.local)) throw new Error(`Equipo local inesperado: ${parsed.local.nombre}`);
  if (expected.visitante && normalizeIdentity(parsed.visitante.nombre) !== normalizeIdentity(expected.visitante)) throw new Error(`Equipo visitante inesperado: ${parsed.visitante.nombre}`);
  if (expected.goles_local !== undefined && parsed.local.goles !== expected.goles_local) throw new Error(`Marcador local inesperado: ${parsed.local.goles}`);
  if (expected.goles_visitante !== undefined && parsed.visitante.goles !== expected.goles_visitante) throw new Error(`Marcador visitante inesperado: ${parsed.visitante.goles}`);
}

export function parsePlanillaDryRun({ workItem, extractedText, expected = null }) {
  const sourceUrl = validatePdfWorkItem(workItem);
  if (typeof extractedText !== 'string' || !extractedText.trim()) throw new Error('Texto extraído de planilla vacío');
  const parsed = parseOfficialFemebalSheet(extractedText);
  assertExpectedMatch(parsed, expected);
  return {
    dry_run: true,
    write_enabled: false,
    auth_used: false,
    source_url: sourceUrl,
    source: { ...workItem.source, pdf_url: sourceUrl },
    parsed,
    validation: { player_goal_totals_match_score: true, expected_match_checked: Boolean(expected) },
  };
}
