import assert from 'node:assert/strict';
import { adaptTournamentTrackerTorneoOffline } from './tournamenttracker-torneo-adapter-core.mjs';
import { validateTournamentTrackerFixtureOffline } from './tournamenttracker-fixture-validator-core.mjs';

const evidence = {
  source: 'tournamenttracker_decrypted_torneo_offline',
  network_used: false,
  auth_used: false,
  write_enabled: false,
};

const control = {
  id: '775',
  fases: [{
    id: 'fase-a',
    zonas: [{
      id: 'zona-a',
      partidos: [{
        id: 'control-match',
        numeroFecha: '1',
        horario: '2026-03-21T20:15:00',
        nombreLocal: 'Argentinos Juniors',
        nombreVisitante: 'Ferro Carril Oeste',
        golesLocal: '20',
        golesVisitante: '27',
        planillas: [{ pdf: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf' }],
      }],
    }],
  }],
};

const fixture = adaptTournamentTrackerTorneoOffline({ torneo: control, evidence });
assert.equal(fixture.source, 'tournamenttracker_offline_fixture');
assert.equal(fixture.partidos.length, 1);
assert.equal(fixture.partidos[0].fecha, '2026-03-21');
assert.equal(fixture.partidos[0].goles_local, 20);
assert.equal(fixture.partidos[0].goles_visitante, 27);
assert.equal(fixture.partidos[0].fase_id, 'fase-a');
assert.equal(fixture.partidos[0].zona_id, 'zona-a');

const validated = validateTournamentTrackerFixtureOffline({
  fixture,
  expected: {
    fecha: '2026-03-21',
    local: 'Argentinos Juniors',
    visitante: 'Ferro Carril Oeste',
    goles_local: 20,
    goles_visitante: 27,
  },
});
assert.equal(validated.expected_match_checked, true);
assert.match(validated.pdf_url, /5ce377051ea0acb1\.pdf$/);

for (const [label, mutate, pattern] of [
  ['network fail closed', e => { e.network_used = true; }, /network_used=false/],
  ['auth fail closed', e => { e.auth_used = true; }, /autenticación/],
  ['write fail closed', e => { e.write_enabled = true; }, /escritura/],
]) {
  const badEvidence = { ...evidence };
  mutate(badEvidence);
  assert.throws(() => adaptTournamentTrackerTorneoOffline({ torneo: control, evidence: badEvidence }), pattern, label);
}

const badNesting = structuredClone(control);
badNesting.fases[0].zonas[0].partidos = null;
assert.throws(() => adaptTournamentTrackerTorneoOffline({ torneo: badNesting, evidence }), /partidos.*debe ser array/);

const badScore = structuredClone(control);
badScore.fases[0].zonas[0].partidos[0].golesLocal = '20-';
assert.throws(() => adaptTournamentTrackerTorneoOffline({ torneo: badScore, evidence }), /entero no negativo/);

const badDate = structuredClone(control);
badDate.fases[0].zonas[0].partidos[0].horario = '21/03/2026 20:15';
assert.throws(() => adaptTournamentTrackerTorneoOffline({ torneo: badDate, evidence }), /fecha ISO explícita/);

console.log('TournamentTracker Torneo offline adapter smoke: OK');
