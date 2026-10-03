const clean = (value) => String(value ?? '').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const idOf = (value) => clean(value?.id ?? value);

const sameText = (a, b) => fold(a) === fold(b);
const sameId = (a, b) => idOf(a) !== '' && idOf(a) === idOf(b);

function pickEntity(row, key) {
  return row?.[key] ?? row ?? null;
}

function matchDimension(entity, expectedId, expectedText, idKey = 'id', textKey = 'name') {
  if (expectedId != null && clean(expectedId) !== '') return sameId(entity?.[idKey], expectedId);
  if (expectedText != null && clean(expectedText) !== '') return sameText(entity?.[textKey], expectedText);
  return true;
}

export function resolveTeamExact(teams, scope = {}) {
  if (!Array.isArray(teams)) throw new TypeError('teams must be an array');
  if (!clean(scope.clubId)) throw new Error('clubId is required');

  const candidates = teams.filter((team) => {
    const club = team?.club;
    const category = team?.ageCategory ?? team?.category;
    const division = team?.division;
    return (
      sameId(club?.id ?? team?.clubId, scope.clubId) &&
      matchDimension(category, scope.categoryId, scope.category) &&
      matchDimension(division, scope.divisionId, scope.division) &&
      (!clean(scope.gender) || sameText(team?.gender, scope.gender)) &&
      (!clean(scope.teamId) || sameId(team?.id, scope.teamId)) &&
      (!clean(scope.teamName) || sameText(team?.name, scope.teamName)) &&
      (!clean(scope.teamCode) || sameText(team?.code ?? team?.teamCode ?? team?.name?.split(/\s+/).at(-1), scope.teamCode))
    );
  });

  if (candidates.length === 0) {
    return { state: 'team_not_resolved', candidates: [] };
  }
  if (candidates.length > 1) {
    return {
      state: 'team_scope_ambiguous',
      disambiguationRequired: 'teamId_or_teamCode',
      candidates: candidates.map((team) => ({ id: idOf(team?.id), name: team?.name ?? null }))
    };
  }
  return { state: 'resolved', team: candidates[0] };
}

export function resolveTournamentExact(teamTournamentRows, scope = {}) {
  if (!Array.isArray(teamTournamentRows)) throw new TypeError('teamTournamentRows must be an array');
  if (!clean(scope.season) && !clean(scope.tournamentId)) {
    throw new Error('season or tournamentId is required');
  }

  const candidates = teamTournamentRows
    .map((row) => pickEntity(row, 'tournament'))
    .filter(Boolean)
    .filter((tournament) => {
      const season = tournament?.season?.description ?? tournament?.season?.name ?? tournament?.season;
      return (
        (!clean(scope.tournamentId) || sameId(tournament?.id, scope.tournamentId)) &&
        (!clean(scope.season) || sameText(season, scope.season)) &&
        (!clean(scope.tournamentName) || sameText(tournament?.name, scope.tournamentName))
      );
    });

  if (candidates.length === 0) return { state: 'tournament_not_resolved', candidates: [] };
  if (candidates.length > 1) {
    return {
      state: 'tournament_scope_ambiguous',
      disambiguationRequired: 'tournamentId_or_competition',
      candidates: candidates.map((tournament) => ({
        id: idOf(tournament?.id),
        name: tournament?.name ?? null,
        season: tournament?.season?.description ?? tournament?.season?.name ?? tournament?.season ?? null,
        status: tournament?.status ?? null
      }))
    };
  }
  return { state: 'resolved', tournament: candidates[0] };
}

export function buildRosterMemberships({ team, tournament, athletes, sourceEndpoint = null }) {
  if (!team?.id) throw new Error('resolved team with id is required');
  if (!tournament?.id) throw new Error('resolved tournament with id is required');
  if (!Array.isArray(athletes)) throw new TypeError('athletes must be an array');

  const seen = new Set();
  const memberships = [];
  for (const athlete of athletes) {
    const athleteId = idOf(athlete?.id);
    if (!athleteId) throw new Error('roster contains athlete without id');
    if (seen.has(athleteId)) throw new Error(`duplicate athleteId in exact roster: ${athleteId}`);
    seen.add(athleteId);
    memberships.push({
      teamId: idOf(team.id),
      tournamentId: idOf(tournament.id),
      athleteId,
      athlete,
      provenance: {
        sourceEndpoint: sourceEndpoint ?? `/athletes/athletesByTeam/${idOf(team.id)}?tournamentId=${idOf(tournament.id)}`
      }
    });
  }
  return memberships;
}

export function verifyReverseMemberships(memberships, reverseByAthleteId) {
  const missing = [];
  for (const membership of memberships) {
    const rows = reverseByAthleteId?.[membership.athleteId];
    if (!Array.isArray(rows)) {
      missing.push({ ...membership, reason: 'reverse_not_available' });
      continue;
    }
    const ok = rows.some((row) => {
      const team = pickEntity(row, 'team');
      const tournament = pickEntity(row, 'tournament');
      return sameId(team?.id, membership.teamId) && sameId(tournament?.id, membership.tournamentId);
    });
    if (!ok) missing.push({ ...membership, reason: 'reverse_pair_missing' });
  }
  return {
    state: missing.length ? 'integrity_mismatch' : 'verified',
    checked: memberships.length,
    missing
  };
}

export function resolveRosterFromSnapshots({ teams, teamTournaments, athletes, reverseByAthleteId, scope }) {
  const teamResult = resolveTeamExact(teams, scope);
  if (teamResult.state !== 'resolved') return teamResult;

  const tournamentResult = resolveTournamentExact(teamTournaments, scope);
  if (tournamentResult.state !== 'resolved') return { ...tournamentResult, team: teamResult.team };

  const memberships = buildRosterMemberships({
    team: teamResult.team,
    tournament: tournamentResult.tournament,
    athletes
  });

  const reverseVerification = reverseByAthleteId
    ? verifyReverseMemberships(memberships, reverseByAthleteId)
    : { state: 'not_checked', checked: 0, missing: [] };

  if (reverseVerification.state === 'integrity_mismatch') {
    return {
      state: 'integrity_mismatch',
      team: teamResult.team,
      tournament: tournamentResult.tournament,
      memberships,
      reverseVerification
    };
  }

  return {
    state: 'resolved',
    team: teamResult.team,
    tournament: tournamentResult.tournament,
    memberships,
    reverseVerification
  };
}
