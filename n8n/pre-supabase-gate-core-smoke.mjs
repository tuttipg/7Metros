import assert from 'node:assert/strict';
import { validatePreSupabaseCandidate } from './pre-supabase-gate-core.mjs';

const sourceUrl = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const base = {
  dry_run: true,
  write_enabled: false,
  auth_used: false,
  source_url: sourceUrl,
  source: {
    page_url: 'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',
    pdf_url: sourceUrl,
    document_type: 'planilla_partido_pdf',
    provenance: 'public_explicit_link',
    source_type: 'fecha_normal',
  },
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
  source_provenance_revalidated: true,
  team_ids_resolved: true,
});

const stringIdResult = validatePreSupabaseCandidate({ dryRunResult: base, mapping: { local_equipo_id: '3', visitante_equipo_id: '1' } });
assert.equal(stringIdResult.match.local_equipo_id, 3);
assert.equal(stringIdResult.match.visitante_equipo_id, 1);
const stringScoreResult = validatePreSupabaseCandidate({
  dryRunResult: { ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: '20' }, visitante: { ...base.parsed.visitante, goles: '27' } } },
  mapping,
});
assert.equal(stringScoreResult.match.goles_local, 20);
assert.equal(stringScoreResult.match.goles_visitante, 27);

const mustFail = [
  [{ ...base, dry_run: false }, mapping],
  [{ ...base, write_enabled: true }, mapping],
  [{ ...base, auth_used: true }, mapping],
  [{ ...base, validation: { ...base.validation, player_goal_totals_match_score: false } }, mapping],
  [{ ...base, validation: { ...base.validation, expected_match_checked: false } }, mapping],
  [{ ...base, source: { ...base.source, provenance: 'public_index' } }, mapping],
  [{ ...base, source: { ...base.source, document_type: 'programacion_pdf' } }, mapping],
  [{ ...base, source: { ...base.source, page_url: 'https://example.com/programacion/' } }, mapping],
  [{ ...base, source: { ...base.source, source_type: 'unknown' } }, mapping],
  [{ ...base, source: { ...base.source, pdf_url: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/other.pdf' } }, mapping],
  [{ ...base, parsed: { ...base.parsed, fecha: '21/03/2026' } }, mapping],
  [{ ...base, parsed: { ...base.parsed, fecha: '2026-02-30' } }, mapping],
  [{ ...base, parsed: { ...base.parsed, fecha: '2026-13-01' } }, mapping],
  [{ ...base, parsed: { ...base.parsed, fecha: 20260321 } }, mapping],
  [{ ...base, parsed: { ...base.parsed, fecha: true } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, nombre: true } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, nombre: 123 } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, nombre: ['Argentinos Juniors'] } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, visitante: { ...base.parsed.visitante, nombre: { club: 'Ferro Carril Oeste' } } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: -1 } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: true } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: '020' } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: '20.0' } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: ' 20 ' } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: Number.MAX_SAFE_INTEGER + 1 } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: String(Number.MAX_SAFE_INTEGER + 1) } } }, mapping],
  [base, { local_equipo_id: null, visitante_equipo_id: 1 }],
  [base, { local_equipo_id: 1, visitante_equipo_id: 1 }],
  [base, { local_equipo_id: true, visitante_equipo_id: 2 }],
  [base, { local_equipo_id: '01', visitante_equipo_id: 2 }],
  [base, { local_equipo_id: '1.0', visitante_equipo_id: 2 }],
  [base, { local_equipo_id: ' 1 ', visitante_equipo_id: 2 }],
  [base, { local_equipo_id: Number.MAX_SAFE_INTEGER + 1, visitante_equipo_id: 2 }],
  [base, { local_equipo_id: String(Number.MAX_SAFE_INTEGER + 1), visitante_equipo_id: 2 }],
];
for (const [dryRunResult, badMapping] of mustFail) {
  assert.throws(() => validatePreSupabaseCandidate({ dryRunResult, mapping: badMapping }));
}

console.log('✓ pre-Supabase gate: provenance, fecha/texto, marcador e IDs estrictos revalidados; partido control validado; producción permanece bloqueada');
