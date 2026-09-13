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

assert.throws(
  () => extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf' }),
  /programación FEMEBAL/,
);
assert.throws(
  () => extractTopDivisionProgrammingCandidates({ text: CONTROL_TEXT, sourceUrl: 'https://evil.example/wp-content/uploads/2026/03/Sabado-21-3.pdf' }),
  /allowlist/,
);

console.log('FEMEBAL programming candidate smoke test: OK');
