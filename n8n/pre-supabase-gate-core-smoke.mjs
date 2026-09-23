import assert from 'node:assert/strict';
import { validatePreSupabaseCandidate } from './pre-supabase-gate-core.mjs';

const sourceUrl = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const expected = { fecha: '2026-03-21', local: 'Argentinos Juniors', visitante: 'Ferro Carril Oeste', goles_local: 20, goles_visitante: 27 };
const base = {
  dry_run: true, write_enabled: false, auth_used: false, source_url: sourceUrl,
  source: { page_url: 'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/', pdf_url: sourceUrl, document_type: 'planilla_partido_pdf', provenance: 'public_explicit_link', source_type: 'fecha_normal' },
  parsed: {
    fecha: '2026-03-21', local: { nombre: 'Argentinos Juniors', goles: 20 }, visitante: { nombre: 'Ferro Carril Oeste', goles: 27 },
    jugadores_local: [{ goles: 12 }, { goles: 8 }], jugadores_visitante: [{ goles: 19 }, { goles: 8 }],
  },
  validation: { player_goal_totals_match_score: true, expected_match_checked: true, expected_match_evidence: expected },
};
const mapping = { local_equipo_id: 3, visitante_equipo_id: 1 };
const result = validatePreSupabaseCandidate({ dryRunResult: base, mapping });
assert.equal(result.safe, true);
assert.equal(result.production_write_allowed, false);
assert.equal(result.match.fecha, '2026-03-21');
assert.equal(result.match.goles_local, 20);
assert.equal(result.match.goles_visitante, 27);
assert.equal(result.validation.expected_match_evidence_revalidated, true);

// Canonical strings remain accepted for IDs/scores while ambiguous coercions fail closed.
const stringIds = validatePreSupabaseCandidate({ dryRunResult: base, mapping: { local_equipo_id: '3', visitante_equipo_id: '1' } });
assert.equal(stringIds.match.local_equipo_id, 3);
const stringScores = validatePreSupabaseCandidate({ dryRunResult: { ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: '20' }, visitante: { ...base.parsed.visitante, goles: '27' } } }, mapping });
assert.equal(stringScores.match.goles_visitante, 27);

// A stale/forged upstream boolean can no longer substitute for structured expected-match evidence.
for (const validation of [
  { ...base.validation, expected_match_checked: false },
  { ...base.validation, expected_match_evidence: null },
  { ...base.validation, expected_match_evidence: { ...expected, goles_visitante: 26 } },
  { ...base.validation, expected_match_evidence: { ...expected, local: 'Otro Club' } },
  { ...base.validation, expected_match_evidence: { ...expected, fecha: '2026-03-22' } },
  { ...base.validation, expected_match_evidence: { ...expected, goles_local: true } },
]) assert.throws(() => validatePreSupabaseCandidate({ dryRunResult: { ...base, validation }, mapping }));

// Player-goal closure is independently recomputed at this boundary too.
assert.throws(() => validatePreSupabaseCandidate({ dryRunResult: { ...base, parsed: { ...base.parsed, jugadores_local: [{ goles: 19 }] } }, mapping }), /Goles local no cierran en boundary/);

const badCases = [
  [{ ...base, dry_run: false }, mapping], [{ ...base, write_enabled: true }, mapping], [{ ...base, auth_used: true }, mapping],
  [{ ...base, source: { ...base.source, provenance: 'public_index' } }, mapping],
  [{ ...base, source: { ...base.source, document_type: 'programacion_pdf' } }, mapping],
  [{ ...base, source: { ...base.source, page_url: 'https://example.com/' } }, mapping],
  [{ ...base, source: { ...base.source, source_type: 'unknown' } }, mapping],
  [{ ...base, parsed: { ...base.parsed, fecha: '21/03/2026' } }, mapping],
  [{ ...base, parsed: { ...base.parsed, fecha: '2026-02-30' } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, nombre: true } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, local: { ...base.parsed.local, goles: '020' } } }, mapping],
  [{ ...base, parsed: { ...base.parsed, jugadores_local: [] } }, mapping],
  [{ ...base, parsed: { ...base.parsed, jugadores_visitante: [{ goles: true }] } }, mapping],
  [base, { local_equipo_id: true, visitante_equipo_id: 2 }], [base, { local_equipo_id: '01', visitante_equipo_id: 2 }], [base, { local_equipo_id: 1, visitante_equipo_id: 1 }],
];
for (const [dryRunResult, badMapping] of badCases) assert.throws(() => validatePreSupabaseCandidate({ dryRunResult, mapping: badMapping }));

console.log('✓ pre-Supabase gate: identidad esperada estructurada, proveniencia, marcador, cierre de goles e IDs revalidados; producción bloqueada');
