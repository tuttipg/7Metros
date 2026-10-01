const REQUIRED_SCOPE_FIELDS = ['club_id', 'temporada_id', 'categoria', 'division', 'rama'];

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} debe ser un entero positivo`);
  return number;
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
  return Number(team?.club_id) === scope.club_id
    && Number(team?.temporada_id) === scope.temporada_id
    && rowText(team?.categoria) === scope.categoria
    && rowText(team?.division) === scope.division
    && rowText(team?.rama) === scope.rama;
}

function publicCandidate(team) {
  return {
    id: Number(team.id),
    club_id: Number(team.club_id),
    temporada_id: Number(team.temporada_id),
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
  if (!Number.isInteger(Number(equipo.id)) || Number(equipo.id) <= 0) {
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

  const equipoId = Number(teamResolution.equipo.id);
  const rosterRows = planteles.filter((row) => Number(row?.equipo_id) === equipoId);
  const playerById = new Map();
  for (const player of jugadores) {
    const id = Number(player?.id);
    if (Number.isInteger(id) && id > 0) playerById.set(id, player);
  }

  const seenPlayerIds = new Set();
  const joined = [];
  const duplicatePlayerIds = [];
  const missingPlayerIds = [];

  for (const roster of rosterRows) {
    const playerId = Number(roster?.jugador_id);
    if (!Number.isInteger(playerId) || playerId <= 0 || !playerById.has(playerId)) {
      missingPlayerIds.push(Number.isFinite(playerId) ? playerId : null);
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
