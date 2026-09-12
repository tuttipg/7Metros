function positiveId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Resuelve el contexto competitivo de una ficha de jugador sin adivinar.
 *
 * Reglas:
 * - un `team` explícito en la URL solo se acepta si el jugador pertenece a ese equipo;
 * - si exactamente una pertenencia del jugador está visible en el filtro actual, se conserva;
 * - si más de una pertenencia está visible, el contexto es ambiguo y debe elegirse;
 * - fuera del filtro actual, una única pertenencia de temporada puede resolverse sola;
 * - múltiples pertenencias sin contexto son ambiguas y deben mostrarse para elegir;
 * - IDs inexistentes nunca deben caer silenciosamente en otro jugador.
 */
export function resolvePlayerRouteContext({
  playerId,
  requestedTeamId = null,
  visibleMembershipTeamIds = [],
  membershipTeamIds = []
} = {}) {
  const targetPlayerId = positiveId(playerId);
  if (!targetPlayerId) return { status: 'missing', playerId: null, teamId: null };

  const memberships = [...new Set((membershipTeamIds || []).map(positiveId).filter(Boolean))];
  const visibleMemberships = [...new Set((visibleMembershipTeamIds || []).map(positiveId).filter(Boolean))]
    .filter(teamId => memberships.includes(teamId));
  const requested = positiveId(requestedTeamId);

  if (requested) {
    return memberships.includes(requested)
      ? { status: 'team', playerId: targetPlayerId, teamId: requested }
      : { status: 'invalid-team', playerId: targetPlayerId, teamId: null };
  }

  if (visibleMemberships.length === 1) {
    return { status: 'current', playerId: targetPlayerId, teamId: visibleMemberships[0] };
  }

  if (visibleMemberships.length > 1) {
    return { status: 'ambiguous', playerId: targetPlayerId, teamId: null, choices: visibleMemberships };
  }

  if (memberships.length === 1) {
    return { status: 'team', playerId: targetPlayerId, teamId: memberships[0] };
  }

  if (memberships.length > 1) {
    return { status: 'ambiguous', playerId: targetPlayerId, teamId: null, choices: memberships };
  }

  return { status: 'missing', playerId: targetPlayerId, teamId: null };
}
