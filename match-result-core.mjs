function validScore(value) {
  // Avoid JS coercion of arrays, hexadecimal, exponent notation and booleans.
  // Public scores are non-negative integers, or their decimal text equivalents.
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return false;
  const score = Number(value.trim());
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
