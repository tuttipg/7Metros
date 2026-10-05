import assert from 'node:assert/strict';
import { extractTopDivisionProgrammingCandidates } from './programming-candidate-core.mjs';

const SOURCE = 'https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf';
const CLUBS = [
  { id: 3, name: 'Argentinos Juniors', aliases: ['AAAJ'] },
  { id: 1, name: 'Ferro Carril Oeste', aliases: ['Ferro'] },
];

const noTopDivision = extractTopDivisionProgrammingCandidates({
  text: `Programacion de partidos\n21 de marzo de 2026\nCategoria Division Hora Rama Local Visitante\nInfantiles A 09:30 M Argentinos Juniors Ferro Carril Oeste\nMayores Liga de Honor Plata 19:45 F Argentinos Juniors Ferro Carril Oeste`,
  sourceUrl: SOURCE,
  clubCatalog: CLUBS,
});

assert.equal(noTopDivision.safe, true);
assert.equal(noTopDivision.dry_run, true);
assert.equal(noTopDivision.write_enabled, false);
assert.equal(noTopDivision.auth_used, false);
assert.equal(noTopDivision.match_date, '2026-03-21');
assert.equal(noTopDivision.complete, false, 'Una fecha valida sin LHC/LHD no debe ser un descubrimiento completo');
assert.equal(noTopDivision.candidates.length, 0);
assert.deepEqual(noTopDivision.errors, [
  { stage: 'programming_parse', error: 'no_top_division_candidates' },
]);

console.log('FEMEBAL programming empty-candidate regression smoke test: OK');
