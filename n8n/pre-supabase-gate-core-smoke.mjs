import assert from 'node:assert/strict';
import { validatePreSupabaseCandidate } from './pre-supabase-gate-core.mjs';

const sourceUrl = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const base = {
  dry_run: true,
  write_enabled: false,
  auth_used: false,
  source_url: sourceUrl,
  source: { pdf_url: sourceUrl },
  parsed: {
    fecha: '2026-03-21',
    local: { nombre: 'Argentinos Juniors', goles: 20 },
    visitante: { nombre: 'Ferro Carril Oeste', goles: 27 },
  },
  validation: {
    player_goal_totals_match_score: true,
    expected_match_checked: true,
  },
};
const mapping = { local_equipo_id: 3, visitante_equipo_id: 1 };

const result = validatePreSupabaseCandidate({ dryRunResult: base, mapping });
assert.equal(result.safe, true);
assert.equal(result.dry_run, true);
assert.equal(result.write_enabled, false);
assert.equal(result.production_write_allowed, false);
assert.equal(result.eligible_for_preproduction_payload, true);
assert.equal(result.evidence_scope, 'official_planilla_validated_match_result');
assert.equal(result.match.fecha, '2026-03-21');
assert.equal(result.match.local_equipo_id, 3);
assert.equal(result.match.visitante_equipo_id, 1);
assert.equal(result.match.goles_local, 20);
assert.equal(result.match.goles_visitante, 27);
assert.deepEqual(result.validation, {
  player_goal_totals_match_score: true,
  expected_match_checked: true,
  source_pdf_consistent: true,
  team_ids_resolved: true,
});

const mustFail = [
  [{ ...base, dry_run: false }, mapping],
  [{ ...base, write_enabled: true }, mapping],
  [{ ...base, auth_used: true }, mapping],
  [{ ...base, validation: { ...base.validation, player_goal_totals_match_score: false } }, mapping],
  [{ ...base, validation: { ...base.validation, expected_match_checked: false } }, mapping],
  [{ ...base, source: { pdf_url: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/other.pdf' } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: -1 } } }, mapping],
  [base, { local_equipo_id: null, visitante_equipo_id: 1 }],
  [base, { local_equipo_id: 1, visitante_equipo_id: 1 }],
];
for (const [dryRunResult, badMapping] of mustFail) {
  assert.throws(() => validatePreSupabaseCandidate({ dryRunResult, mapping: badMapping }));
}

console.log('✓ pre-Supabase gate: partido control validado; producción permanece bloqueada');
