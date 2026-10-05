import { parseOfficialFemebalSheet } from './planilla-core.mjs';
import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/;

function validatePublicExplicitSource(source, sourceUrl) {
  const sourcePdfUrl = canonicalizeOfficialFemebalUrl(source.pdf_url, { pdf: true });
  if (sourcePdfUrl !== sourceUrl) throw new Error('La fuente del work item no coincide con su URL');
  if (source.document_type !== 'planilla_partido_pdf') throw new Error('La fuente debe ser document_type=planilla_partido_pdf');
  canonicalizeOfficialFemebalUrl(source.page_url);
  if (!['fecha_normal', 'reprogramacion'].includes(source.source_type)) throw new Error('source_type de la planilla inválido');
}

function validateTournamentTrackerSource(item, source, sourceUrl) {
  const sourcePdfUrl = canonicalizeOfficialFemebalUrl(source.pdf_url, { pdf: true });
  if (sourcePdfUrl !== sourceUrl) throw new Error('La fuente TournamentTracker no coincide con su URL');
  if (item.kind !== 'tournamenttracker_selected_official_pdf') throw new Error('kind incompatible con provenance TournamentTracker');
  if (item.dry_run !== true) throw new Error('TournamentTracker PDF requiere dry_run=true');
  if (source.torneo_verified_exact_body !== true) throw new Error('TournamentTracker requiere torneo_verified_exact_body=true');
  if (typeof source.torneo_artifact_sha256 !== 'string' || !SHA256_RE.test(source.torneo_artifact_sha256)) throw new Error('torneo_artifact_sha256 inválido');
  if (!Number.isSafeInteger(source.torneo_artifact_bytes) || source.torneo_artifact_bytes < 1) throw new Error('torneo_artifact_bytes inválido');
  if (source.network_used !== false || source.auth_used !== false || source.write_enabled !== false) throw new Error('Fuente TournamentTracker fuera de frontera SAFE');
  if (!item.expected_match || typeof item.expected_match !== 'object' || Array.isArray(item.expected_match)) throw new Error('TournamentTracker requiere expected_match');
}

export function validatePdfWorkItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Work item PDF inválido');
  if (!['femebal_official_pdf', 'tournamenttracker_selected_official_pdf'].includes(item.kind)) throw new Error('kind de work item inválido');
  if (item.method !== 'GET') throw new Error('El work item debe usar GET');
  if (item.allow_redirects !== false) throw new Error('Los redirects deben estar deshabilitados');
  if (item.auth_used !== false) throw new Error('El work item no puede usar autenticación');
  if (item.write_enabled !== false) throw new Error('El work item no puede habilitar escritura');

  const sourceUrl = canonicalizeOfficialFemebalUrl(item.url, { pdf: true });
  if (!item.source || typeof item.source !== 'object' || Array.isArray(item.source)) throw new Error('Fuente del work item inválida');
  if (item.source.provenance === 'public_explicit_link') validatePublicExplicitSource(item.source, sourceUrl);
  else if (item.source.provenance === 'tournamenttracker_verified_torneo_selection') validateTournamentTrackerSource(item, item.source, sourceUrl);
  else throw new Error('Provenance de planilla no permitida');
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
