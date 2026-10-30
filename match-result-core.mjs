function validScore(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0;
}

export function hasVerifiedMatchResult(row) {
  if (!row) return false;
  const status = String(row.estado ?? '').trim().toLowerCase();
  // An empty legacy status can still carry a real score; arbitrary states cannot.
  if (status !== '' && status !== 'final' && status !== 'finalizado') return false;
  return validScore(row.goles_local) && validScore(row.goles_visitante);
}

export function matchPublicStatus(row) {
  if (hasVerifiedMatchResult(row)) return 'Finalizado';
  const status = String(row?.estado ?? '').trim().toLowerCase();
  // Only an explicitly scheduled match may appear in the upcoming list.
  // A missing legacy status without a verified score is not evidence of scheduling.
  return status === 'programado' ? 'Programado' : 'Sin resultado';
}
