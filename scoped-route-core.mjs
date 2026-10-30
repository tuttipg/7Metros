import { canonicalPositiveId } from './route-id-core.mjs';

function validId(value) {
  return canonicalPositiveId(value) !== null;
}

export function resolveScopedRouteContext({
  entityId,
  requestedTeamId = null,
  currentPresent = false,
  memberships = []
} = {}) {
  const normalizedEntityId = canonicalPositiveId(entityId);
  if (normalizedEntityId === null) return { status: 'invalid', entityId: null };

  const normalized = (memberships || [])
    .map(row => ({
      teamId: Number(row?.teamId),
      contextKey: String(row?.contextKey || '')
    }))
    .filter(row => validId(row.teamId) && row.contextKey);

  if (!normalized.length) return { status: 'missing', entityId: normalizedEntityId };

  if (requestedTeamId !== null && requestedTeamId !== undefined) {
    const explicitTeamId = canonicalPositiveId(requestedTeamId);
    if (explicitTeamId === null) {
      return { status: 'invalid-team', entityId: normalizedEntityId, teamId: null };
    }
    const membership = normalized.find(row => row.teamId === explicitTeamId);
    if (!membership) {
      return { status: 'invalid-team', entityId: normalizedEntityId, teamId: explicitTeamId };
    }
    return {
      status: 'team',
      entityId: normalizedEntityId,
      teamId: membership.teamId,
      contextKey: membership.contextKey
    };
  }

  if (currentPresent) return { status: 'current', entityId: normalizedEntityId };

  const contexts = new Map();
  normalized.forEach(row => {
    if (!contexts.has(row.contextKey)) contexts.set(row.contextKey, row.teamId);
  });

  if (contexts.size === 1) {
    const [[contextKey, teamId]] = contexts.entries();
    return { status: 'team', entityId: normalizedEntityId, teamId, contextKey };
  }

  return {
    status: 'ambiguous',
    entityId: normalizedEntityId,
    teamIds: normalized.map(row => row.teamId),
    contextKeys: [...contexts.keys()]
  };
}
