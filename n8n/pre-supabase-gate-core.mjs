import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

function positiveId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
function nonNegativeInteger(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}
function requiredText(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} debe ser texto`);
  const text = value.trim();
  if (!text) throw new Error(`Falta ${label}`);
  return text;
}
function strictIsoDate(value) {
  const text = requiredText(value, 'fecha');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error('Fecha inválida: se requiere YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Fecha calendario inválida');
  }
  return text;
}

/** Fail-closed boundary between parsed FEMEBAL evidence and any future Supabase payload. Never writes. */
export function validatePreSupabaseCandidate({ dryRunResult, mapping }) {
  if (!dryRunResult || typeof dryRunResult !== 'object' || Array.isArray(dryRunResult)) throw new Error('Resultado DRY RUN inválido');
  if (dryRunResult.dry_run !== true) throw new Error('Se requiere dry_run=true');
  if (dryRunResult.write_enabled !== false) throw new Error('write_enabled debe permanecer false');
  if (dryRunResult.auth_used !== false) throw new Error('auth_used debe permanecer false');
  if (dryRunResult.validation?.player_goal_totals_match_score !== true) throw new Error('No está validado el cierre de goles de jugadores contra marcador');
  if (dryRunResult.validation?.expected_match_checked !== true) throw new Error('El partido debe estar contrastado contra una identidad esperada');

  if (!dryRunResult.source || typeof dryRunResult.source !== 'object' || Array.isArray(dryRunResult.source)) throw new Error('Fuente DRY RUN inválida');
  if (dryRunResult.source.provenance !== 'public_explicit_link') throw new Error('La planilla requiere provenance=public_explicit_link');
  if (dryRunResult.source.document_type !== 'planilla_partido_pdf') throw new Error('La fuente debe ser document_type=planilla_partido_pdf');
  const pageUrl = canonicalizeOfficialFemebalUrl(dryRunResult.source.page_url);
  if (!['fecha_normal', 'reprogramacion'].includes(dryRunResult.source.source_type)) throw new Error('source_type de la planilla inválido');

  const sourceUrl = canonicalizeOfficialFemebalUrl(dryRunResult.source_url, { pdf: true });
  const sourcePdfUrl = canonicalizeOfficialFemebalUrl(dryRunResult.source.pdf_url, { pdf: true });
  if (sourceUrl !== sourcePdfUrl) throw new Error('La proveniencia PDF no coincide');

  const parsed = dryRunResult.parsed;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Planilla parseada ausente');
  const fecha = strictIsoDate(parsed.fecha);
  const local = requiredText(parsed.local?.nombre, 'equipo local');
  const visitante = requiredText(parsed.visitante?.nombre, 'equipo visitante');
  const golesLocal = nonNegativeInteger(parsed.local?.goles);
  const golesVisitante = nonNegativeInteger(parsed.visitante?.goles);
  if (golesLocal === null || golesVisitante === null) throw new Error('Marcador inválido');

  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('Mapping de equipos ausente');
  const localId = positiveId(mapping.local_equipo_id);
  const visitanteId = positiveId(mapping.visitante_equipo_id);
  if (!localId || !visitanteId) throw new Error('Ambos equipo_id deben estar resueltos');
  if (localId === visitanteId) throw new Error('Local y visitante no pueden compartir equipo_id');

  return {
    safe: true, dry_run: true, write_enabled: false, production_write_allowed: false,
    eligible_for_preproduction_payload: true,
    source_url: sourceUrl,
    source: {
      provenance: 'public_explicit_link',
      document_type: 'planilla_partido_pdf',
      page_url: pageUrl,
      pdf_url: sourceUrl,
      source_type: dryRunResult.source.source_type,
    },
    evidence_scope: 'official_planilla_validated_match_result',
    match: { fecha, local_equipo_id: localId, visitante_equipo_id: visitanteId, local_nombre: local, visitante_nombre: visitante, goles_local: golesLocal, goles_visitante: golesVisitante },
    validation: {
      player_goal_totals_match_score: true,
      expected_match_checked: true,
      source_pdf_consistent: true,
      source_provenance_revalidated: true,
      team_ids_resolved: true,
    },
  };
}
