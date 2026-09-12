export function matchUiStatus(match, todayIso) {
  const status = String(match?.status || '');
  if (status === 'Finalizado') return { code: 'final', label: 'Finalizado' };

  const date = String(match?.date || '');
  const today = String(todayIso || '');
  const hasScore = match?.homeScore !== null && match?.homeScore !== undefined
    && match?.awayScore !== null && match?.awayScore !== undefined;

  if (!hasScore && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{4}-\d{2}-\d{2}$/.test(today) && date < today) {
    return { code: 'result-pending', label: 'Resultado pendiente' };
  }

  return { code: 'scheduled', label: 'Programado' };
}
