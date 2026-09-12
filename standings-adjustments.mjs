function finiteInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Valida ajustes administrativos explícitos antes de que puedan afectar una tabla.
 * Fail-closed: un registro ambiguo, huérfano o sin fuente oficial no se aplica.
 * Este módulo no infiere sanciones desde marcadores, fixtures ni planillas ausentes.
 */
export function validateAdministrativeAdjustment(adjustment, scope = {}) {
  const errors = [];
  const teamId = finiteInt(adjustment?.teamId);
  const seasonId = finiteInt(adjustment?.seasonId);
  const competitionId = finiteInt(adjustment?.competitionId);
  const pointsDelta = finiteInt(adjustment?.pointsDelta);

  if (teamId === null) errors.push('teamId requerido');
  if (seasonId === null) errors.push('seasonId requerido');
  if (competitionId === null) errors.push('competitionId requerido');
  if (pointsDelta === null || pointsDelta === 0) errors.push('pointsDelta entero no cero requerido');
  if (!nonEmpty(adjustment?.reason)) errors.push('reason requerido');
  if (!nonEmpty(adjustment?.officialSource)) errors.push('officialSource requerida');
  if (!nonEmpty(adjustment?.resolutionDate)) errors.push('resolutionDate requerida');

  if (scope.seasonId != null && seasonId !== finiteInt(scope.seasonId)) errors.push('seasonId fuera de scope');
  if (scope.competitionId != null && competitionId !== finiteInt(scope.competitionId)) errors.push('competitionId fuera de scope');
  if (scope.teamIds && !new Set(scope.teamIds.map(Number)).has(teamId)) errors.push('teamId fuera de scope');

  return { valid: errors.length === 0, errors };
}

/**
 * Devuelve una copia de la tabla con puntos deportivos y administrativos separados.
 * Solo aplica registros válidos y del scope explícito. Los inválidos se reportan.
 */
export function applyAdministrativeAdjustments(clubs, adjustments = [], scope = {}) {
  const rows = (clubs || []).map(club => ({
    ...club,
    sportingPoints: Number(club.points) || 0,
    administrativePoints: 0,
    appliedAdjustments: []
  }));
  const byTeam = new Map(rows.map(row => [Number(row.teamId), row]));
  const rejected = [];

  for (const adjustment of adjustments || []) {
    const check = validateAdministrativeAdjustment(adjustment, scope);
    const row = byTeam.get(Number(adjustment?.teamId));
    if (!check.valid || !row) {
      rejected.push({ adjustment, errors: row ? check.errors : [...check.errors, 'teamId sin fila en tabla'] });
      continue;
    }
    row.administrativePoints += Number(adjustment.pointsDelta);
    row.appliedAdjustments.push({ ...adjustment });
  }

  for (const row of rows) row.points = row.sportingPoints + row.administrativePoints;
  return { rows, rejected };
}
