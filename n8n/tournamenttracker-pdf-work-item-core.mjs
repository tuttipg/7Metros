import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/;

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value;
}

function normalizeIdentity(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function requireIsoDate(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} inválida`);
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error(`${label} debe usar YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${label} no es una fecha calendario válida`);
  }
  return text;
}

function requireClock(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} inválida`);
  const text = value.trim();
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) throw new Error(`${label} inválida`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) throw new Error(`${label} inválida`);
  return text.slice(0, 5);
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} inválido`);
  return value.trim();
}

function requireScore(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} inválido`);
  return value;
}

function validateExpectedMatch(expected) {
  requireObject(expected, 'Partido esperado');
  return {
    fecha: requireIsoDate(expected.fecha, 'Fecha esperada'),
    hora: requireClock(expected.hora, 'Hora esperada'),
    categoria: requireText(expected.categoria, 'Categoría esperada'),
    division: requireText(expected.division, 'División esperada'),
    local: requireText(expected.local, 'Equipo local esperado'),
    visitante: requireText(expected.visitante, 'Equipo visitante esperado'),
    goles_local: requireScore(expected.goles_local, 'Marcador local esperado'),
    goles_visitante: requireScore(expected.goles_visitante, 'Marcador visitante esperado'),
  };
}

function validateSelectedMatch(match, expected) {
  requireObject(match, 'Partido seleccionado');
  const fecha = requireIsoDate(match.fecha, 'Fecha del partido seleccionado');
  const hora = requireClock(match.hora, 'Hora del partido seleccionado');
  const categoria = requireText(match.categoria, 'Categoría del partido seleccionado');
  const division = requireText(match.division, 'División del partido seleccionado');
  const local = requireText(match.local, 'Equipo local seleccionado');
  const visitante = requireText(match.visitante, 'Equipo visitante seleccionado');
  const golesLocal = requireScore(match.goles_local, 'Marcador local seleccionado');
  const golesVisitante = requireScore(match.goles_visitante, 'Marcador visitante seleccionado');
  if (fecha !== expected.fecha
      || hora !== expected.hora
      || normalizeIdentity(categoria) !== normalizeIdentity(expected.categoria)
      || normalizeIdentity(division) !== normalizeIdentity(expected.division)
      || normalizeIdentity(local) !== normalizeIdentity(expected.local)
      || normalizeIdentity(visitante) !== normalizeIdentity(expected.visitante)
      || golesLocal !== expected.goles_local
      || golesVisitante !== expected.goles_visitante) {
    throw new Error('El partido seleccionado no coincide exactamente con expected_match');
  }
  return { fecha, hora, categoria, division, local, visitante, goles_local: golesLocal, goles_visitante: golesVisitante };
}

export function buildTournamentTrackerPdfWorkItem(selection) {
  requireObject(selection, 'Selección TournamentTracker');
  if (selection.dry_run !== true) throw new Error('La selección debe ser dry_run=true');
  if (selection.network_used !== false) throw new Error('La selección debe declarar network_used=false');
  if (selection.auth_used !== false) throw new Error('La selección no puede usar autenticación');
  if (selection.write_enabled !== false) throw new Error('La selección no puede habilitar escritura');
  if (selection.expected_match_checked !== true) throw new Error('La selección debe validar el partido esperado');

  const provenance = requireObject(selection.provenance, 'Provenance TournamentTracker');
  if (provenance.source !== 'tournamenttracker_decrypted_torneo_offline') throw new Error('source de provenance inválido');
  if (provenance.verified_exact_body !== true) throw new Error('La provenance exige verified_exact_body=true');
  if (provenance.network_used !== false || provenance.auth_used !== false || provenance.write_enabled !== false) {
    throw new Error('La provenance TournamentTracker no cumple frontera SAFE');
  }
  if (typeof provenance.artifact_sha256 !== 'string' || !SHA256_RE.test(provenance.artifact_sha256)) throw new Error('artifact_sha256 inválido');
  if (!Number.isSafeInteger(provenance.artifact_bytes) || provenance.artifact_bytes < 1) throw new Error('artifact_bytes inválido');

  const pdfUrl = canonicalizeOfficialFemebalUrl(selection.pdf_url, { pdf: true });
  const expected = validateExpectedMatch(selection.expected_match);
  const match = requireObject(selection.match, 'Partido seleccionado');
  const selectedMatch = validateSelectedMatch(match, expected);
  if (!Array.isArray(match.planillas) || match.planillas.length !== 1) throw new Error('La selección debe contener exactamente una planilla');
  const matchPdf = canonicalizeOfficialFemebalUrl(match.planillas[0]?.pdf, { pdf: true });
  if (matchPdf !== pdfUrl) throw new Error('pdf_url no coincide con la planilla seleccionada');

  return {
    kind: 'tournamenttracker_selected_official_pdf',
    method: 'GET',
    allow_redirects: false,
    auth_used: false,
    write_enabled: false,
    dry_run: true,
    url: pdfUrl,
    expected_match: { ...expected },
    source: {
      provenance: 'tournamenttracker_verified_torneo_selection',
      pdf_url: pdfUrl,
      torneo_artifact_sha256: provenance.artifact_sha256,
      torneo_artifact_bytes: provenance.artifact_bytes,
      torneo_verified_exact_body: true,
      network_used: false,
      auth_used: false,
      write_enabled: false,
      selected_match: selectedMatch,
    },
  };
}
