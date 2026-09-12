import { SEASON_ID } from './config.js';
import { state, getClub, getMatch } from './store.js';
import { renderCurrentPage } from './pages.js';
import { renderCompetitionBar } from './ui.js';
import { resolveScopedRouteContext } from './scoped-route-core.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function contextKey(team) {
  return [team?.categoria || '', team?.division || '', team?.rama || ''].join('|');
}

function seasonTeamsForClub(clubId) {
  return state.teams.filter(team =>
    Number(team.temporada_id) === Number(SEASON_ID) && Number(team.club_id) === Number(clubId)
  );
}

function matchTeams(match) {
  return [match?.homeTeamId, match?.awayTeamId]
    .map(id => state.index.teamById.get(Number(id)))
    .filter(team => team && Number(team.temporada_id) === Number(SEASON_ID));
}

function teamLabel(team) {
  const club = state.index.clubById.get(Number(team?.club_id));
  const clubName = club?.name || team?.nombre_femebal || 'Equipo';
  const branch = team?.rama === 'F' ? 'Femenino' : team?.rama === 'M' ? 'Masculino' : (team?.rama || '');
  return [clubName, team?.categoria, team?.division, branch].filter(Boolean).join(' · ');
}

function renderRouteError(root, title, text, choices = [], entityId = null) {
  const choiceLinks = choices.map(team => {
    const href = new URL(location.href);
    href.searchParams.set('id', String(entityId));
    href.searchParams.set('team', String(team.id));
    return `<a class="btn light" href="${esc(href.pathname + href.search)}">${esc(teamLabel(team))}</a>`;
  }).join('');

  const fallback = document.body.dataset.page === 'clubes' ? 'clubes.html' : 'partidos.html';
  root.innerHTML = `<div class="empty-state"><b>${esc(title)}</b><p>${esc(text)}</p>${choiceLinks ? `<div class="section-foot-actions">${choiceLinks}</div>` : `<a class="btn light" href="${fallback}">Volver</a>`}</div>`;
}

function applyTeamContext(teamId, entityId) {
  const team = state.index.teamById.get(Number(teamId));
  if (!team) return false;

  state.filters = {
    categoria: team.categoria || '',
    division: team.division || '',
    rama: team.rama || ''
  };

  const url = new URL(location.href);
  url.searchParams.set('id', String(entityId));
  url.searchParams.set('team', String(team.id));
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);

  renderCompetitionBar();
  renderCurrentPage();
  return true;
}

function resolveClubRoute(root, params) {
  const clubId = Number(params.get('id'));
  const requestedTeamId = Number(params.get('team'));
  const memberships = seasonTeamsForClub(clubId);
  const clubExists = state.index.clubById.has(clubId);

  if (!clubExists) {
    renderRouteError(root, 'Club no disponible', 'No encontramos el club solicitado en la temporada actual.');
    return;
  }

  const resolution = resolveScopedRouteContext({
    entityId: clubId,
    requestedTeamId,
    currentPresent: Boolean(getClub(clubId)),
    memberships: memberships.map(team => ({ teamId: team.id, contextKey: contextKey(team) }))
  });

  if (resolution.status === 'current') return;
  if (resolution.status === 'team') {
    if (!applyTeamContext(resolution.teamId, resolution.entityId)) {
      renderRouteError(root, 'Contexto de club no disponible', 'El equipo asociado no está disponible en esta temporada.');
    }
    return;
  }
  if (resolution.status === 'ambiguous') {
    const unique = [];
    const seen = new Set();
    memberships.forEach(team => {
      const key = contextKey(team);
      if (!seen.has(key)) { seen.add(key); unique.push(team); }
    });
    renderRouteError(root, 'Elegí la competencia del club', 'Este club participa en más de una competencia. Elegí el contexto para no mezclar estadísticas.', unique, clubId);
    return;
  }
  if (resolution.status === 'invalid-team') {
    renderRouteError(root, 'Contexto de club inválido', 'El club no pertenece al equipo indicado en este enlace.');
    return;
  }
  renderRouteError(root, 'Club no disponible', 'No encontramos un equipo de este club en la temporada actual.');
}

function resolveMatchRoute(root, params) {
  const matchId = Number(params.get('id'));
  const requestedTeamId = Number(params.get('team'));
  const match = state.index.matchById.get(matchId);

  if (!match) {
    renderRouteError(root, 'Partido no disponible', 'No encontramos el partido solicitado en la temporada actual.');
    return;
  }

  const memberships = matchTeams(match);
  const resolution = resolveScopedRouteContext({
    entityId: matchId,
    requestedTeamId,
    currentPresent: Boolean(getMatch(matchId)),
    memberships: memberships.map(team => ({ teamId: team.id, contextKey: contextKey(team) }))
  });

  if (resolution.status === 'current') return;
  if (resolution.status === 'team') {
    if (!applyTeamContext(resolution.teamId, resolution.entityId)) {
      renderRouteError(root, 'Contexto de partido no disponible', 'El partido existe, pero su competencia no está disponible.');
    }
    return;
  }
  if (resolution.status === 'invalid-team') {
    renderRouteError(root, 'Contexto de partido inválido', 'El equipo indicado no participa en este partido.');
    return;
  }
  if (resolution.status === 'ambiguous') {
    renderRouteError(root, 'Contexto de partido inconsistente', 'Los equipos del partido no comparten la misma competencia. No mostramos datos para evitar atribuciones incorrectas.');
    return;
  }
  renderRouteError(root, 'Partido no disponible', 'No pudimos resolver la competencia del partido solicitado.');
}

let attempts = 0;
function guardScopedRoute() {
  const clubRoot = document.getElementById('club-detail');
  const matchRoot = document.getElementById('match-detail');
  const root = clubRoot || matchRoot;
  if (!root) return;

  if (!state.loaded) {
    attempts += 1;
    if (!state.error && attempts < 120) setTimeout(guardScopedRoute, 50);
    return;
  }

  const params = new URLSearchParams(location.search);
  if (clubRoot) resolveClubRoute(clubRoot, params);
  else resolveMatchRoute(matchRoot, params);
}

guardScopedRoute();
