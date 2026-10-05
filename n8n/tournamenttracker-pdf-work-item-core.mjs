import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/;

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value;
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
  const expected = requireObject(selection.expected_match, 'Partido esperado');
  const match = requireObject(selection.match, 'Partido seleccionado');
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
    },
  };
}
