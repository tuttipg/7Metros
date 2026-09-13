import assert from 'node:assert/strict';
import { extractTopDivisionProgrammingCandidates } from './programming-candidate-core.mjs';

const SOURCE = 'https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf';
const CONTROL_TEXT = `
Programacion de partidos
21 de marzo de 2026
AAAJ Globo (Argentinos Juniors) Gimnasio
Categoria Division Hora Rama Local Visitante Arbitros
Infantiles A 09:30 M Argentinos Juniors Ferro Carril Oeste
Mayores 1º Division 16:45 F Argentinos Juniors S.E.C.L.A.
Mayores LHD Hipotecario Seguros 18:30 F Argentinos Juniors Ferro Carril Oeste 1-Femebal, 1-Femebal
Mayores LHC Hipotecario Seguros 20:15 M Argentinos Juniors Ferro Carril Oeste 1-Femebal, 1-Femebal
Mayores Liga de Honor Plata 19:45 F Ci.De.Co. C.A. San Lorenzo de Almagro
`;

const result = extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: SOURCE });
assert.equal(result.safe, true);
assert.equal(result.dry_run, true);
assert.equal(result.write_enabled, false);
assert.equal(result.auth_used, false);
assert.equal(result.complete, true);
assert.equal(result.match_date, '2026-03-21');
assert.equal(result.candidates.length, 2);

const control = result.candidates.find((item) => item.division === 'LHC Hipotecario Seguros');
assert.ok(control, 'Debe detectar el partido control de LHC');
assert.equal(control.time, '20:15');
assert.equal(control.branch, 'M');
assert.match(control.raw_matchup_and_officials, /^Argentinos Juniors Ferro Carril Oeste\b/);
assert.equal(control.source_url, SOURCE);

const lhd = result.candidates.find((item) => item.division === 'LHD Hipotecario Seguros');
assert.ok(lhd, 'Debe detectar LHD sin confundir otras divisiones');
assert.equal(lhd.time, '18:30');
assert.equal(result.candidates.some((item) => item.division === 'Liga de Honor Plata'), false);

const missingDate = extractTopDivisionProgrammingCandidates({
  text: 'Mayores LHC Hipotecario Seguros 20:15 M Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
});
assert.equal(missingDate.complete, false);
assert.equal(missingDate.match_date, null);
assert.equal(missingDate.candidates[0].date, null);
assert.equal(missingDate.errors[0].error, 'missing_or_invalid_programming_date');

assert.throws(
  () => extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf' }),
  /programación FEMEBAL/,
);
assert.throws(
  () => extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: 'https://evil.example/wp-content/uploads/2026/03/Sabado-21-3.pdf' }),
  /allowlist/,
);

console.log('FEMEBAL programming candidate smoke test: OK');
