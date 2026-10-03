import assert from 'node:assert/strict';
import {
  resolveTeamExact,
  resolveTournamentExact,
  buildRosterMemberships,
  verifyReverseMemberships,
  resolveRosterFromSnapshots
} from './roster-resolver-core.mjs';

const teams = [
  {
    id: 1843,
    name: 'Mayores A',
    club: { id: 335, name: 'Ferro Carril Oeste' },
    ageCategory: { id: 100, name: 'Mayores' },
    division: { id: 421, name: 'LHC Hipotecario Seguros' },
    gender: 'Masculino'
  },
  {
    id: 9999,
    name: 'Mayores B',
    club: { id: 335, name: 'Ferro Carril Oeste' },
    ageCategory: { id: 100, name: 'Mayores' },
    division: { id: 421, name: 'LHC Hipotecario Seguros' },
    gender: 'Masculino'
  }
];

const tournaments = [
  { tournament: { id: 775, name: 'Torneo Metropolitano Apertura', season: { description: '2026' }, status: 'finished' } },
  { tournament: { id: 1204, name: 'Torneo Metropolitano Clausura', season: { description: '2026' }, status: 'active' } }
];

const athletes = [
  { id: 16284, firstName: 'Juan Martín', lastName: 'Bartolomeo' },
  { id: 19480, firstName: 'Valentín', lastName: 'Schankula' }
];

const humanScope = {
  clubId: 335,
  season: '2026',
  categoryId: 100,
  divisionId: 421,
  gender: 'Masculino'
};

const ambiguousTeam = resolveTeamExact(teams, humanScope);
assert.equal(ambiguousTeam.state, 'team_scope_ambiguous');
assert.equal(ambiguousTeam.candidates.length, 2);

const teamResolved = resolveTeamExact(teams, { ...humanScope, teamCode: 'A' });
assert.equal(teamResolved.state, 'resolved');
assert.equal(String(teamResolved.team.id), '1843');

const ambiguousTournament = resolveTournamentExact(tournaments, humanScope);
assert.equal(ambiguousTournament.state, 'tournament_scope_ambiguous');
assert.deepEqual(ambiguousTournament.candidates.map((x) => String(x.id)).sort(), ['1204', '775']);

const tournamentResolved = resolveTournamentExact(tournaments, { ...humanScope, tournamentId: 775 });
assert.equal(tournamentResolved.state, 'resolved');
assert.equal(String(tournamentResolved.tournament.id), '775');

const memberships = buildRosterMemberships({
  team: teamResolved.team,
  tournament: tournamentResolved.tournament,
  athletes
});
assert.deepEqual(
  memberships.map((m) => [m.teamId, m.tournamentId, m.athleteId]),
  [['1843', '775', '16284'], ['1843', '775', '19480']]
);

const reverse = {
  '16284': [{ team: { id: 1843 }, tournament: { id: 775 } }],
  '19480': [{ team: { id: 1843 }, tournament: { id: 776 } }, { team: { id: 1843 }, tournament: { id: 775 } }]
};
assert.equal(verifyReverseMemberships(memberships, reverse).state, 'verified');

const full = resolveRosterFromSnapshots({
  teams,
  teamTournaments: tournaments,
  athletes,
  reverseByAthleteId: reverse,
  scope: { ...humanScope, teamCode: 'A', tournamentId: 775 }
});
assert.equal(full.state, 'resolved');
assert.equal(full.memberships.length, 2);
assert.equal(full.reverseVerification.state, 'verified');

const badReverse = structuredClone(reverse);
badReverse['19480'] = [{ team: { id: 1843 }, tournament: { id: 776 } }];
assert.equal(verifyReverseMemberships(memberships, badReverse).state, 'integrity_mismatch');

assert.throws(
  () => buildRosterMemberships({ team: teamResolved.team, tournament: tournamentResolved.tournament, athletes: [athletes[0], athletes[0]] }),
  /duplicate athleteId/
);

console.log('✓ roster-resolver-core: team/tournament ambiguity fails closed, exact roster and reverse integrity validated');
