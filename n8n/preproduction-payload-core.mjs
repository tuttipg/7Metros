import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

function positiveId(value, label) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} inválido`);
    return value;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new Error(`${label} inválido`);
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new Error(`${label} inválido`);
  return id;
}

function nonNegativeInteger(value, label) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} inválido`);
    return value;
  }
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) throw new Error(`${label} inválido`);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`${label} inválido`);
  return number;
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
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Fecha calendario inválida');
  return text;
}

/**
 * Converts an already validated pre-Supabase candidate into a deterministic,
 * serializable preview. It deliberately contains no table/RPC/HTTP target and
 * never grants write permission, so callers cannot mistake this object for an
 * executable Supabase request.
 */
export function buildPreproductionPayload(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Candidato pre-Supabase inválido');
  if (candidate.safe !== true || candidate.dry_run !== true) throw new Error('El candidato debe permanecer SAFE/DRY RUN');
  if (candidate.write_enabled !== false || candidate.production_write_allowed !== false) throw new Error('La escritura productiva debe permanecer bloqueada');
  if (candidate.eligible_for_preproduction_payload !== true) throw new Error('Candidato no habilitado para preview de preproducción');
  if (candidate.evidence_scope !== 'official_planilla_validated_match_result') throw new Error('Evidence scope no soportado');

  if (!candidate.source || typeof candidate.source !== 'object' || Array.isArray(candidate.source)) throw new Error('Evidencia de origen ausente');
  if (candidate.source.provenance !== 'public_explicit_link') throw new Error('La planilla requiere provenance=public_explicit_link');
  if (candidate.source.document_type !== 'planilla_partido_pdf') throw new Error('La fuente debe ser document_type=planilla_partido_pdf');
  if (!['fecha_normal', 'reprogramacion'].includes(candidate.source.source_type)) throw new Error('source_type de la planilla inválido');
  const pageUrl = canonicalizeOfficialFemebalUrl(candidate.source.page_url);
  const sourceUrl = canonicalizeOfficialFemebalUrl(candidate.source_url, { pdf: true });
  const sourcePdfUrl = canonicalizeOfficialFemebalUrl(candidate.source.pdf_url, { pdf: true });
  if (sourceUrl !== sourcePdfUrl) throw new Error('La proveniencia PDF no coincide');

  const match = candidate.match;
  if (!match || typeof match !== 'object' || Array.isArray(match)) throw new Error('Partido validado ausente');
  const fecha = strictIsoDate(match.fecha);
  const localId = positiveId(match.local_equipo_id, 'local_equipo_id');
  const visitanteId = positiveId(match.visitante_equipo_id, 'visitante_equipo_id');
  if (localId === visitanteId) throw new Error('Local y visitante no pueden compartir equipo_id');
  const localNombre = requiredText(match.local_nombre, 'local_nombre');
  const visitanteNombre = requiredText(match.visitante_nombre, 'visitante_nombre');
  const golesLocal = nonNegativeInteger(match.goles_local, 'goles_local');
  const golesVisitante = nonNegativeInteger(match.goles_visitante, 'goles_visitante');

  if (candidate.validation?.player_goal_totals_match_score !== true
    || candidate.validation?.expected_match_checked !== true
    || candidate.validation?.expected_match_evidence_revalidated !== true
    || candidate.validation?.source_pdf_consistent !== true
    || candidate.validation?.source_provenance_revalidated !== true
    || candidate.validation?.team_ids_resolved !== true
    || candidate.validation?.team_mapping_identity_revalidated !== true) {
    throw new Error('Validaciones pre-Supabase incompletas');
  }

  return {
    schema_version: 1,
    safe: true,
    dry_run: true,
    write_enabled: false,
    production_write_allowed: false,
    executable_request: false,
    target: null,
    operation: 'preview_only',
    evidence_scope: candidate.evidence_scope,
    source_url: sourceUrl,
    source: {
      provenance: 'public_explicit_link',
      document_type: 'planilla_partido_pdf',
      page_url: pageUrl,
      pdf_url: sourceUrl,
      source_type: candidate.source.source_type,
    },
    payload: {
      fecha,
      local_equipo_id: localId,
      visitante_equipo_id: visitanteId,
      local_nombre: localNombre,
      visitante_nombre: visitanteNombre,
      goles_local: golesLocal,
      goles_visitante: golesVisitante,
      fuente_planilla: sourceUrl,
    },
  };
}
