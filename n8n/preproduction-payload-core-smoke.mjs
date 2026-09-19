import assert from 'node:assert/strict';
import { buildPreproductionPayload } from './preproduction-payload-core.mjs';

const sourceUrl = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const candidate = {
  safe: true,
  dry_run: true,
  write_enabled: false,
  production_write_allowed: false,
  eligible_for_preproduction_payload: true,
  source_url: sourceUrl,
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
    source_pdf_consistent: true,
    team_ids_resolved: true,
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

for (const bad of [
  { ...candidate, safe: false },
  { ...candidate, dry_run: false },
  { ...candidate, write_enabled: true },
  { ...candidate, production_write_allowed: true },
  { ...candidate, eligible_for_preproduction_payload: false },
  { ...candidate, evidence_scope: 'scheduled_match_identity_only' },
  { ...candidate, validation: { ...candidate.validation, expected_match_checked: false } },
  { ...candidate, match: { ...candidate.match, visitante_equipo_id: 3 } },
  { ...candidate, match: { ...candidate.match, goles_local: -1 } },
]) assert.throws(() => buildPreproductionPayload(bad));

console.log('✓ preproduction payload: AAAJ 20-27 Ferro preview determinístico; sin request ni escritura');
