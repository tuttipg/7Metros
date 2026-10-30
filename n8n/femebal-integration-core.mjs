function canonicalId(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new Error(`${label} inválido`);
  return text;
}

function optionalCanonicalId(value, label) {
  if (value === null || value === undefined || value === '') return null;
  return canonicalId(value, label);
}

function normalizeIdentity(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function requireParsedSide(parsed, side) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Planilla parseada inválida');
  if (!['local', 'visitante'].includes(side)) throw new Error('side debe ser local o visitante');
  const team = parsed[side];
  const players = parsed[`jugadores_${side}`];
  if (!team || typeof team !== 'object' || typeof team.nombre !== 'string') throw new Error(`Equipo ${side} inválido`);
  if (!Array.isArray(players) || !players.length) throw new Error(`Jugadores ${side} inválidos`);
  return { team, players };
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

export function integratePlanillaWithOfficialIdsDryRun({
  parsed,
  context,
  rosterAthleteIds,
  participantMappings,
  requireCompleteSide = true,
}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw new Error('Contexto de integración inválido');

  const clubId = canonicalId(context.clubId, 'clubId');
  const teamId = canonicalId(context.teamId, 'teamId');
  const tournamentId = canonicalId(context.tournamentId, 'tournamentId');
  const matchId = optionalCanonicalId(context.matchId, 'matchId');
  const matchSheetId = optionalCanonicalId(context.matchSheetId, 'matchSheetId');
  const side = context.side;
  const { team, players } = requireParsedSide(parsed, side);

  if (context.expectedTeamName !== undefined) {
    if (typeof context.expectedTeamName !== 'string' || !context.expectedTeamName.trim()) {
      throw new Error('expectedTeamName inválido');
    }
    if (normalizeIdentity(team.nombre) !== normalizeIdentity(context.expectedTeamName)) {
      throw new Error(`Nombre de equipo inesperado: ${team.nombre}`);
    }
  }

  if (!Array.isArray(rosterAthleteIds) || !rosterAthleteIds.length) throw new Error('rosterAthleteIds inválido');
  const roster = rosterAthleteIds.map((value) => canonicalId(value, 'athleteId de roster'));
  if (new Set(roster).size !== roster.length) throw new Error('Roster contiene athleteId duplicado');
  const rosterSet = new Set(roster);

  if (!Array.isArray(participantMappings) || !participantMappings.length) throw new Error('participantMappings inválido');

  const rowsByDorsal = new Map();
  for (const row of players) {
    if (!Number.isSafeInteger(row.dorsal) || row.dorsal < 0) throw new Error('Dorsal de planilla inválido');
    if (rowsByDorsal.has(row.dorsal)) throw new Error(`Dorsal duplicado en planilla: ${row.dorsal}`);
    rowsByDorsal.set(row.dorsal, row);
  }

  const seenAthletes = new Set();
  const seenDorsals = new Set();
  const resolved = [];

  for (const mapping of participantMappings) {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('Mapping de participante inválido');
    const athleteId = canonicalId(mapping.athleteId, 'athleteId de participante');
    const dorsal = mapping.dorsal;

    if (!Number.isSafeInteger(dorsal) || dorsal < 0) throw new Error('Dorsal de mapping inválido');
    if (seenAthletes.has(athleteId)) throw new Error(`athleteId duplicado en mappings: ${athleteId}`);
    if (seenDorsals.has(dorsal)) throw new Error(`Dorsal duplicado en mappings: ${dorsal}`);
    if (!rosterSet.has(athleteId)) throw new Error(`athleteId fuera del roster: ${athleteId}`);

    const row = rowsByDorsal.get(dorsal);
    if (!row) throw new Error(`Dorsal no encontrado en planilla: ${dorsal}`);
    if (typeof mapping.provenance !== 'string' || !mapping.provenance.trim()) {
      throw new Error('provenance de mapping requerida');
    }

    seenAthletes.add(athleteId);
    seenDorsals.add(dorsal);
    resolved.push({
      athleteId,
      dorsal,
      nombre_planilla: `${row.nombre} ${row.apellido}`.trim(),
      goles: row.goles,
      tarjeta_amarilla: row.tarjeta_amarilla,
      exclusiones_2min: row.exclusiones_2min,
      tarjeta_roja: row.tarjeta_roja,
      tarjeta_azul: row.tarjeta_azul,
      mapping_provenance: mapping.provenance,
    });
  }

  if (requireCompleteSide && resolved.length !== players.length) {
    throw new Error(`Mapping incompleto: planilla=${players.length}, mappings=${resolved.length}`);
  }

  const rosterNotObserved = roster.filter((athleteId) => !seenAthletes.has(athleteId));
  const summary = {
    jugadores_resueltos: resolved.length,
    goles: sum(resolved, 'goles'),
    amarillas: sum(resolved, 'tarjeta_amarilla'),
    exclusiones_2min: sum(resolved, 'exclusiones_2min'),
    rojas: sum(resolved, 'tarjeta_roja'),
    azules: sum(resolved, 'tarjeta_azul'),
  };

  const canonicalParticipations = matchId === null ? [] : resolved.map((row) => ({
    matchId,
    athleteId: row.athleteId,
    teamId,
    tournamentId,
    matchSheetId,
    dorsal_utilizado: row.dorsal,
    goles: row.goles,
    tarjeta_amarilla: row.tarjeta_amarilla,
    exclusiones_2min: row.exclusiones_2min,
    tarjeta_roja: row.tarjeta_roja,
    tarjeta_azul: row.tarjeta_azul,
  }));

  return {
    dry_run: true,
    write_enabled: false,
    identity_policy: {
      primary_ids: ['clubId', 'teamId', 'tournamentId', 'athleteId', 'matchId', 'matchSheetId'],
      name_join_used: false,
      sheet_row_locator: 'side+dorsal',
    },
    context: { clubId, teamId, tournamentId, matchId, matchSheetId, side },
    status: matchId === null ? 'pending_match_id' : 'canonical_match_ready',
    team_name_crosscheck: context.expectedTeamName ? team.nombre : null,
    resolved_participants: resolved,
    canonical_participations: canonicalParticipations,
    roster_not_observed: rosterNotObserved,
    summary,
    validation: {
      all_mappings_in_roster: true,
      mapping_complete_for_side: resolved.length === players.length,
      match_id_confirmed: matchId !== null,
    },
  };
}
