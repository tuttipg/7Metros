import assert from 'node:assert/strict';
import { buildPreproductionPayload } from './preproduction-payload-core.mjs';

const sourceUrl = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const pageUrl = 'https://www.femebal.com/partidos';
const candidate = {
  safe: true,
  dry_run: true,
  write_enabled: false,
  production_write_allowed: false,
  eligible_for_preproduction_payload: true,
  source_url: sourceUrl,
  source: {
    provenance: 'public_explicit_link',
    document_type: 'planilla_partido_pdf',
    page_url: pageUrl,
    pdf_url: sourceUrl,
    source_type: 'fecha_normal',
  },
  evidence_scope: 'official_planilla_validated_match_result',
  match: {
    fecha: '2026-03-21',
    local_equipo_id: 3,
    visitante_equipo_id: 1,
    local_nombre: 'Argentinos Juniors',
    visitante_nombre: 'Ferro Carril Oeste',
    goles_local: 20,
    goles_visitante: 27,
  },
  validation: {
    player_goal_totals_match_score: true,
    expected_match_checked: true,
    expected_match_evidence_revalidated: true,
    source_pdf_consistent: true,
    source_provenance_revalidated: true,
    team_ids_resolved: true,
    team_mapping_identity_revalidated: true,
  },
};

const preview = buildPreproductionPayload(candidate);
assert.equal(preview.schema_version, 1);
assert.equal(preview.safe, true);
assert.equal(preview.dry_run, true);
assert.equal(preview.write_enabled, false);
assert.equal(preview.production_write_allowed, false);
assert.equal(preview.executable_request, false);
assert.equal(preview.target, null);
assert.equal(preview.operation, 'preview_only');
assert.deepEqual(preview.source, candidate.source);
assert.deepEqual(preview.payload, {
  fecha: '2026-03-21',
  local_equipo_id: 3,
  visitante_equipo_id: 1,
  local_nombre: 'Argentinos Juniors',
  visitante_nombre: 'Ferro Carril Oeste',
  goles_local: 20,
  goles_visitante: 27,
  fuente_planilla: sourceUrl,
});
assert.equal(Object.hasOwn(preview, 'rpc'), false);
assert.equal(Object.hasOwn(preview, 'url'), false);
assert.equal(Object.hasOwn(preview, 'method'), false);

// Canonical decimal strings remain accepted for compatibility, but ambiguous coercions fail closed.
const stringScalars = buildPreproductionPayload({ ...candidate, match: { ...candidate.match, local_equipo_id: '3', visitante_equipo_id: '1', goles_local: '20', goles_visitante: '27' } });
assert.equal(stringScalars.payload.local_equipo_id, 3);
assert.equal(stringScalars.payload.goles_visitante, 27);

for (const bad of [
  { ...candidate, safe: false },
  { ...candidate, dry_run: false },
  { ...candidate, write_enabled: true },
  { ...candidate, production_write_allowed: true },
  { ...candidate, eligible_for_preproduction_payload: false },
  { ...candidate, evidence_scope: 'scheduled_match_identity_only' },
  { ...candidate, source: undefined },
  { ...candidate, source: { ...candidate.source, provenance: 'public_index' } },
  { ...candidate, source: { ...candidate.source, document_type: 'programacion_pdf' } },
  { ...candidate, source: { ...candidate.source, page_url: 'https://example.com/partidos' } },
  { ...candidate, source: { ...candidate.source, pdf_url: 'https://www.femebal.com/otra.pdf' } },
  { ...candidate, source: { ...candidate.source, source_type: 'unknown' } },
  { ...candidate, validation: { ...candidate.validation, source_provenance_revalidated: false } },
  { ...candidate, validation: { ...candidate.validation, expected_match_checked: false } },
  { ...candidate, validation: { ...candidate.validation, expected_match_evidence_revalidated: false } },
  { ...candidate, validation: { ...candidate.validation, team_mapping_identity_revalidated: false } },
  { ...candidate, validation: { ...candidate.validation, expected_match_evidence_revalidated: undefined } },
  { ...candidate, validation: { ...candidate.validation, team_mapping_identity_revalidated: undefined } },
  { ...candidate, match: { ...candidate.match, visitante_equipo_id: 3 } },
  { ...candidate, match: { ...candidate.match, goles_local: -1 } },
  { ...candidate, match: { ...candidate.match, local_equipo_id: true } },
  { ...candidate, match: { ...candidate.match, local_equipo_id: '03' } },
  { ...candidate, match: { ...candidate.match, local_equipo_id: '3.0' } },
  { ...candidate, match: { ...candidate.match, local_equipo_id: ' 3 ' } },
  { ...candidate, match: { ...candidate.match, local_equipo_id: '9007199254740992' } },
  { ...candidate, match: { ...candidate.match, goles_local: true } },
  { ...candidate, match: { ...candidate.match, goles_local: '020' } },
  { ...candidate, match: { ...candidate.match, goles_local: '20.0' } },
  { ...candidate, match: { ...candidate.match, goles_local: ' 20 ' } },
  { ...candidate, match: { ...candidate.match, goles_local: '9007199254740992' } },
  { ...candidate, match: { ...candidate.match, fecha: 20260321 } },
  { ...candidate, match: { ...candidate.match, fecha: '2026-02-30' } },
  { ...candidate, match: { ...candidate.match, local_nombre: true } },
  { ...candidate, match: { ...candidate.match, visitante_nombre: { nombre: 'Ferro Carril Oeste' } } },
]) assert.throws(() => buildPreproductionPayload(bad));

console.log('✓ preproduction payload: AAAJ 20-27 Ferro; exige evidencia revalidada de identidad/mapping; escalares estrictos; sin request ni escritura');
