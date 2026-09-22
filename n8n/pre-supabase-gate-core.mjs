import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`Falta ${label}`);
  return text;
}

/**
 * Fail-closed boundary between parsed FEMEBAL evidence and any future Supabase payload.
 * This function never writes and never returns permission for a production write.
 */
export function validatePreSupabaseCandidate({ dryRunResult, mapping }) {
  if (!dryRunResult || typeof dryRunResult !== 'object' || Array.isArray(dryRunResult)) {
    throw new Error('Resultado DRY RUN inválido');
  }
  if (dryRunResult.dry_run !== true) throw new Error('Se requiere dry_run=true');
  if (dryRunResult.write_enabled !== false) throw new Error('write_enabled debe permanecer false');
  if (dryRunResult.auth_used !== false) throw new Error('auth_used debe permanecer false');
  if (dryRunResult.validation?.player_goal_totals_match_score !== true) {
    throw new Error('No está validado el cierre de goles de jugadores contra marcador');
  }
  if (dryRunResult.validation?.expected_match_checked !== true) {
    throw new Error('El partido debe estar contrastado contra una identidad esperada');
  }

  // Revalidate discovery provenance at the final boundary before payload construction.
  // Do not trust a caller merely because it presents a parser-shaped DRY RUN object.
  if (!dryRunResult.source || typeof dryRunResult.source !== 'object' || Array.isArray(dryRunResult.source)) {
    throw new Error('Fuente DRY RUN inválida');
  }
  if (dryRunResult.source.provenance !== 'public_explicit_link') {
    throw new Error('La planilla requiere provenance=public_explicit_link');
  }
  if (dryRunResult.source.document_type !== 'planilla_partido_pdf') {
    throw new Error('La fuente debe ser document_type=planilla_partido_pdf');
  }
  canonicalizeOfficialFemebalUrl(dryRunResult.source.page_url);
  if (!['fecha_normal', 'reprogramacion'].includes(dryRunResult.source.source_type)) {
    throw new Error('source_type de la planilla inválido');
  }

  const sourceUrl = canonicalizeOfficialFemebalUrl(dryRunResult.source_url, { pdf: true });
  const sourcePdfUrl = canonicalizeOfficialFemebalUrl(dryRunResult.source.pdf_url, { pdf: true });
  if (sourceUrl !== sourcePdfUrl) throw new Error('La proveniencia PDF no coincide');

  const parsed = dryRunResult.parsed;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Planilla parseada ausente');
  const fecha = requiredText(parsed.fecha, 'fecha');
  const local = requiredText(parsed.local?.nombre, 'equipo local');
  const visitante = requiredText(parsed.visitante?.nombre, 'equipo visitante');
  const golesLocal = Number(parsed.local?.goles);
  const golesVisitante = Number(parsed.visitante?.goles);
  if (!Number.isInteger(golesLocal) || golesLocal < 0 || !Number.isInteger(golesVisitante) || golesVisitante < 0) {
    throw new Error('Marcador inválido');
  }

  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('Mapping de equipos ausente');
  const localId = positiveId(mapping.local_equipo_id);
  const visitanteId = positiveId(mapping.visitante_equipo_id);
  if (!localId || !visitanteId) throw new Error('Ambos equipo_id deben estar resueltos');
  if (localId === visitanteId) throw new Error('Local y visitante no pueden compartir equipo_id');

  return {
    safe: true,
    dry_run: true,
    write_enabled: false,
    production_write_allowed: false,
    eligible_for_preproduction_payload: true,
    source_url: sourceUrl,
    evidence_scope: 'official_planilla_validated_match_result',
    match: {
      fecha,
      local_equipo_id: localId,
      visitante_equipo_id: visitanteId,
      local_nombre: local,
      visitante_nombre: visitante,
      goles_local: golesLocal,
      goles_visitante: golesVisitante,
    },
    validation: {
      player_goal_totals_match_score: true,
      expected_match_checked: true,
      source_pdf_consistent: true,
      source_provenance_revalidated: true,
      team_ids_resolved: true,
    },
  };
}
