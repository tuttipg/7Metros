function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function matchFinished(match) {
  return match?.status === 'Finalizado' &&
    Number.isFinite(Number(match.homeScore)) &&
    Number.isFinite(Number(match.awayScore));
}

function resultPoints(own, opp) {
  if (own > opp) return 3;
  if (own === opp) return 2;
  return 1;
}

function overallQuotient(club) {
  const gf = num(club.gf);
  const ga = num(club.ga);
  if (ga === 0) return gf > 0 ? Number.POSITIVE_INFINITY : 0;
  return gf / ga;
}

function miniTable(group, matches) {
  const ids = new Set(group.map(club => Number(club.teamId)).filter(Number.isFinite));
  const stats = new Map(group.map(club => [Number(club.teamId), {
    points: 0,
    gf: 0,
    ga: 0,
    played: 0
  }]));

  for (const match of matches || []) {
    if (!matchFinished(match)) continue;
    const homeId = Number(match.homeTeamId);
    const awayId = Number(match.awayTeamId);
    if (!ids.has(homeId) || !ids.has(awayId)) continue;

    const home = stats.get(homeId);
    const away = stats.get(awayId);
    if (!home || !away) continue;

    const homeScore = num(match.homeScore);
    const awayScore = num(match.awayScore);
    home.played += 1;
    away.played += 1;
    home.gf += homeScore;
    home.ga += awayScore;
    away.gf += awayScore;
    away.ga += homeScore;
    home.points += resultPoints(homeScore, awayScore);
    away.points += resultPoints(awayScore, homeScore);
  }

  return stats;
}

function fallbackCompare(a, b) {
  return num(b.gd) - num(a.gd) ||
    num(b.gf) - num(a.gf) ||
    num(a.ga) - num(b.ga) ||
    overallQuotient(b) - overallQuotient(a) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
}

function sortTieGroup(group, matches) {
  if (group.length < 2) return group.slice();
  const mini = miniTable(group, matches);
  const anyHeadToHead = [...mini.values()].some(row => row.played > 0);
  if (!anyHeadToHead) return group.slice().sort(fallbackCompare);

  return group.slice().sort((a, b) => {
    const ma = mini.get(Number(a.teamId)) || { points: 0, gf: 0, ga: 0 };
    const mb = mini.get(Number(b.teamId)) || { points: 0, gf: 0, ga: 0 };
    const miniGdA = ma.gf - ma.ga;
    const miniGdB = mb.gf - mb.ga;

    return mb.points - ma.points ||
      miniGdB - miniGdA ||
      mb.gf - ma.gf ||
      ma.ga - mb.ga ||
      fallbackCompare(a, b);
  });
}

/**
 * Ordena una tabla Fe.Me.Bal. respetando primero los puntos generales y,
 * entre equipos empatados, el Sistema Olímpico: resultados/puntos entre los
 * empatados, diferencia y goles de esos partidos; luego criterios generales.
 *
 * No resuelve sanciones administrativas ni desempates a partido: esos casos
 * necesitan datos explícitos de la competencia y no deben inferirse.
 */
export function sortStandingsOlympic(clubs, matches = []) {
  const byPoints = (clubs || []).slice().sort((a, b) =>
    num(b.points) - num(a.points) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' })
  );

  const ordered = [];
  let cursor = 0;
  while (cursor < byPoints.length) {
    const points = num(byPoints[cursor].points);
    let end = cursor + 1;
    while (end < byPoints.length && num(byPoints[end].points) === points) end += 1;
    ordered.push(...sortTieGroup(byPoints.slice(cursor, end), matches));
    cursor = end;
  }
  return ordered;
}
