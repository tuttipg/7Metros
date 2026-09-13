import assert from 'node:assert/strict';
import { extractTopDivisionProgrammingCandidates, resolveProgrammingTeams } from './programming-candidate-core.mjs';

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

const CLUBS = [
  { id: 3, name: 'Argentinos Juniors', aliases: ['AAAJ'] },
  { id: 1, name: 'Ferro Carril Oeste', aliases: ['Ferro'] },
];

const result = extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: SOURCE, clubCatalog: CLUBS });
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
assert.equal(control.team_resolution.status, 'resolved');
assert.deepEqual(control.team_resolution.local, {
  id: 3,
  name: 'Argentinos Juniors',
  matched_alias: 'Argentinos Juniors',
});
assert.deepEqual(control.team_resolution.visitor, {
  id: 1,
  name: 'Ferro Carril Oeste',
  matched_alias: 'Ferro Carril Oeste',
});
assert.equal(control.team_resolution.trailing_officials, '1-Femebal, 1-Femebal');

const lhd = result.candidates.find((item) => item.division === 'LHD Hipotecario Seguros');
assert.ok(lhd, 'Debe detectar LHD sin confundir otras divisiones');
assert.equal(lhd.time, '18:30');
assert.equal(lhd.branch, 'F');
assert.equal(lhd.team_resolution.status, 'resolved');
assert.equal(result.candidates.some((item) => item.division === 'Liga de Honor Plata'), false);

const aliasResolution = resolveProgrammingTeams('AAAJ Ferro 1-Femebal', CLUBS);
assert.equal(aliasResolution.status, 'resolved');
assert.equal(aliasResolution.local.id, 3);
assert.equal(aliasResolution.visitor.id, 1);
assert.equal(aliasResolution.trailing_officials, '1-Femebal');

const noCatalog = extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: SOURCE });
assert.equal(noCatalog.candidates[0].team_resolution.status, 'unresolved');
assert.equal(noCatalog.candidates[0].team_resolution.reason, 'catalog_unavailable_or_empty');

const incompleteCatalog = resolveProgrammingTeams('Argentinos Juniors Ferro Carril Oeste 1-Femebal', [CLUBS[0]]);
assert.equal(incompleteCatalog.status, 'unresolved');
assert.equal(incompleteCatalog.reason, 'no_exact_catalog_match');

const ambiguousCatalog = resolveProgrammingTeams('Argentinos Juniors Ferro 1-Femebal', [
  CLUBS[0],
  { id: 1, name: 'Ferro Carril Oeste', aliases: ['Ferro'] },
  { id: 99, name: 'Ferro Handball', aliases: ['Ferro'] },
]);
assert.equal(ambiguousCatalog.status, 'ambiguous');
assert.equal(ambiguousCatalog.reason, 'multiple_exact_catalog_matches');
assert.equal(ambiguousCatalog.match_count, 2);

const missingDate = extractTopDivisionProgrammingCandidates({
  text: 'Mayores LHC Hipotecario Seguros 20:15 M Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});
assert.equal(missingDate.complete, false);
assert.equal(missingDate.match_date, null);
assert.equal(missingDate.candidates[0].date, null);
assert.equal(missingDate.candidates[0].team_resolution.status, 'resolved');
assert.equal(missingDate.errors[0].error, 'missing_or_invalid_programming_date');

const impossibleDate = extractTopDivisionProgrammingCandidates({
  text: '31 de febrero de 2026\nMayores LHC Hipotecario Seguros 20:15 M Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});
assert.equal(impossibleDate.complete, false);
assert.equal(impossibleDate.match_date, null);
assert.equal(impossibleDate.errors[0].error, 'missing_or_invalid_programming_date');

const leapDate = extractTopDivisionProgrammingCandidates({
  text: '29 de febrero de 2028\nMayores LHC Hipotecario Seguros 20:15 M Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});
assert.equal(leapDate.complete, true);
assert.equal(leapDate.match_date, '2028-02-29');
assert.equal(leapDate.candidates.length, 1);

const invalidTime = extractTopDivisionProgrammingCandidates({
  text: '21 de marzo de 2026\nMayores LHC Hipotecario Seguros 24:00 M Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});
assert.equal(invalidTime.complete, false);
assert.equal(invalidTime.candidates.length, 0);
assert.equal(invalidTime.errors.length, 1);
assert.equal(invalidTime.errors[0].error, 'invalid_programming_time');
assert.equal(invalidTime.errors[0].time, '24:00');

const invalidMinute = extractTopDivisionProgrammingCandidates({
  text: '21 de marzo de 2026\nMayores LHD Hipotecario Seguros 18:60 F Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});
assert.equal(invalidMinute.complete, false);
assert.equal(invalidMinute.candidates.length, 0);
assert.equal(invalidMinute.errors[0].error, 'invalid_programming_time');
assert.equal(invalidMinute.errors[0].time, '18:60');

const validLateTime = extractTopDivisionProgrammingCandidates({
  text: '21 de marzo de 2026\nMayores LHC Hipotecario Seguros 23:59 M Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});
assert.equal(validLateTime.complete, true);
assert.equal(validLateTime.candidates.length, 1);
assert.equal(validLateTime.candidates[0].time, '23:59');

const branchMismatch = extractTopDivisionProgrammingCandidates({
  text: '21 de marzo de 2026\nMayores LHC Hipotecario Seguros 20:15 F Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});
assert.equal(branchMismatch.complete, false);
assert.equal(branchMismatch.candidates.length, 0);
assert.equal(branchMismatch.errors.length, 1);
assert.equal(branchMismatch.errors[0].error, 'division_branch_mismatch');
assert.equal(branchMismatch.errors[0].expected_branch, 'M');
assert.equal(branchMismatch.errors[0].actual_branch, 'F');

const lhdBranchMismatch = extractTopDivisionProgrammingCandidates({
  text: '21 de marzo de 2026\nMayores LHD Hipotecario Seguros 18:30 M Argentinos Juniors Ferro Carril Oeste',
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});
assert.equal(lhdBranchMismatch.complete, false);
assert.equal(lhdBranchMismatch.candidates.length, 0);
assert.equal(lhdBranchMismatch.errors[0].error, 'division_branch_mismatch');
assert.equal(lhdBranchMismatch.errors[0].expected_branch, 'F');
assert.equal(lhdBranchMismatch.errors[0].actual_branch, 'M');

assert.throws(
  () => extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf' }),
  /programación FEMEBAL/,
);
assert.throws(
  () => extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: 'https://evil.example/wp-content/uploads/2026/03/Sabado-21-3.pdf' }),
  /allowlist/,
);

console.log('FEMEBAL programming candidate smoke test: OK');
