const REQUIRED_SCOPE_FIELDS = ['club_id', 'temporada_id', 'categoria', 'division', 'rama'];

function positiveInteger(value, label) {
  if (value === null || value === undefined || value === '') throw new Error(`${label} debe ser un entero positivo`);
  let number;
  if (typeof value === 'number') {
    number = value;
  } else if (typeof value === 'string' && /^[1-9][0-9]*$/.test(value)) {
    number = Number(value);
  } else {
    throw new Error(`${label} debe ser un entero positivo decimal canónico`);
  }
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} debe ser un entero positivo seguro`);
  return number;
}

function dataPositiveInteger(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && /^[1-9][0-9]*$/.test(value)) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }
  return null;
}

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} es obligatorio`);
  return text;
}

function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function canonicalScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new Error('scope debe ser un objeto');
  return {
    club_id: positiveInteger(scope.club_id, 'club_id'),
    temporada_id: positiveInteger(scope.temporada_id, 'temporada_id'),
    categoria: requiredText(scope.categoria, 'categoria'),
    division: requiredText(scope.division, 'division'),
    rama: requiredText(scope.rama, 'rama'),
    equipo_codigo: optionalText(scope.equipo_codigo),
  };
}

function rowText(value) {
  return String(value ?? '').trim();
}

function exactBaseScopeMatch(team, scope) {
  const clubId = dataPositiveInteger(team?.club_id);
  const temporadaId = dataPositiveInteger(team?.temporada_id);
  return clubId === scope.club_id
    && temporadaId === scope.temporada_id
    && rowText(team?.categoria) === scope.categoria
    && rowText(team?.division) === scope.division
    && rowText(team?.rama) === scope.rama;
}

function publicCandidate(team) {
  return {
    id: dataPositiveInteger(team.id),
    club_id: dataPositiveInteger(team.club_id),
    temporada_id: dataPositiveInteger(team.temporada_id),
    categoria: rowText(team.categoria),
    division: rowText(team.division),
    rama: rowText(team.rama),
    equipo_codigo: optionalText(team.equipo_codigo),
    nombre_femebal: optionalText(team.nombre_femebal),
  };
}

export function resolveEquipoExact(equipos, rawScope) {
  if (!Array.isArray(equipos)) throw new Error('equipos debe ser un array');
  const scope = canonicalScope(rawScope);

  const baseCandidates = equipos.filter((team) => exactBaseScopeMatch(team, scope));
  const candidates = scope.equipo_codigo
    ? baseCandidates.filter((team) => rowText(team?.equipo_codigo) === scope.equipo_codigo)
    : baseCandidates;

  if (candidates.length === 0) {
    return {
      state: 'equipo_no_resuelto',
      scope,
      equipo: null,
      candidates: [],
    };
  }

  if (candidates.length > 1) {
    return {
      state: 'scope_ambiguo',
      scope,
      equipo: null,
      candidates: candidates.map(publicCandidate),
      disambiguation_required: 'equipo_codigo',
    };
  }

  const equipo = candidates[0];
  if (!dataPositiveInteger(equipo.id)) {
    return {
      state: 'integrity_error',
      scope,
      equipo: null,
      candidates: [publicCandidate(equipo)],
      reason: 'El equipo resuelto no tiene un id válido',
    };
  }

  return {
    state: 'resolved',
    scope,
    equipo: publicCandidate(equipo),
    candidates: [publicCandidate(equipo)],
  };
}

export function resolveJugadoresExact({ equipos, planteles, jugadores }, rawScope) {
  if (!Array.isArray(planteles)) throw new Error('planteles debe ser un array');
  if (!Array.isArray(jugadores)) throw new Error('jugadores debe ser un array');

  const teamResolution = resolveEquipoExact(equipos, rawScope);
  if (teamResolution.state !== 'resolved') {
    return { ...teamResolution, plantel: [], jugadores: [] };
  }

  const equipoId = dataPositiveInteger(teamResolution.equipo.id);
  const rosterRows = planteles.filter((row) => dataPositiveInteger(row?.equipo_id) === equipoId);
  const playerById = new Map();
  for (const player of jugadores) {
    const id = dataPositiveInteger(player?.id);
    if (id !== null) playerById.set(id, player);
  }

  const seenPlayerIds = new Set();
  const joined = [];
  const duplicatePlayerIds = [];
  const missingPlayerIds = [];

  for (const roster of rosterRows) {
    const playerId = dataPositiveInteger(roster?.jugador_id);
    if (playerId === null || !playerById.has(playerId)) {
      missingPlayerIds.push(playerId);
      continue;
    }
    if (seenPlayerIds.has(playerId)) {
      duplicatePlayerIds.push(playerId);
      continue;
    }
    seenPlayerIds.add(playerId);
    const player = playerById.get(playerId);
    joined.push({
      jugador_id: playerId,
      equipo_id: equipoId,
      dorsal: roster?.dorsal ?? null,
      posicion: optionalText(roster?.posicion),
      jugador: { ...player },
    });
  }

  if (missingPlayerIds.length || duplicatePlayerIds.length) {
    return {
      state: 'integrity_error',
      scope: teamResolution.scope,
      equipo: teamResolution.equipo,
      candidates: teamResolution.candidates,
      plantel: rosterRows,
      jugadores: joined,
      reason: 'El plantel contiene referencias inválidas o duplicadas',
      missing_player_ids: missingPlayerIds,
      duplicate_player_ids: [...new Set(duplicatePlayerIds)],
    };
  }

  return {
    state: 'resolved',
    scope: teamResolution.scope,
    equipo: teamResolution.equipo,
    candidates: teamResolution.candidates,
    plantel: rosterRows,
    jugadores: joined,
  };
}

export const EXACT_PLAYER_SCOPE_FIELDS = Object.freeze([...REQUIRED_SCOPE_FIELDS]);
