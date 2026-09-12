import { SEASON_ID } from './config.js';
import { state, filteredTeamIds } from './store.js';
import { renderCurrentPage } from './pages.js';
import { renderCompetitionBar } from './ui.js';
import { resolvePlayerRouteContext } from './player-route-core.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function seasonMemberships(playerId) {
  return (state.index.rosterByPlayer.get(Number(playerId)) || [])
    .filter(row => {
      const team = state.index.teamById.get(Number(row.equipo_id));
      return team && Number(team.temporada_id) === Number(SEASON_ID);
    });
}

function teamLabel(team) {
  const club = state.index.clubById.get(Number(team?.club_id));
  const clubName = club?.name || team?.nombre_femebal || 'Equipo';
  const branch = team?.rama === 'F' ? 'Femenino' : team?.rama === 'M' ? 'Masculino' : (team?.rama || '');
  return [clubName, team?.categoria, team?.division, branch].filter(Boolean).join(' · ');
}

function renderRouteError(root, title, text, memberships = [], playerId = null) {
  const choices = memberships.map(row => {
    const team = state.index.teamById.get(Number(row.equipo_id));
    if (!team) return '';
    const href = new URL(location.href);
    href.searchParams.set('id', String(playerId));
    href.searchParams.set('team', String(team.id));
    return `<a class="btn light" href="${esc(href.pathname + href.search)}">${esc(teamLabel(team))}</a>`;
  }).filter(Boolean).join('');

  root.innerHTML = `<div class="empty-state"><b>${esc(title)}</b><p>${esc(text)}</p>${choices ? `<div class="section-foot-actions">${choices}</div>` : '<a class="btn light" href="jugadores.html">Volver a jugadores</a>'}</div>`;
}

function applyTeamContext(teamId, playerId) {
  const team = state.index.teamById.get(Number(teamId));
  if (!team) return false;

  // Contexto efímero para esta ficha: no se persiste en localStorage y por lo tanto
  // no pisa los filtros elegidos por el usuario en otras páginas.
  state.filters = {
    categoria: team.categoria || '',
    division: team.division || '',
    rama: team.rama || ''
  };

  const url = new URL(location.href);
  url.searchParams.set('id', String(playerId));
  url.searchParams.set('team', String(team.id));
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);

  renderCompetitionBar();
  renderCurrentPage();
  return true;
}

let attempts = 0;
function guardPlayerRoute() {
  const root = document.getElementById('player-detail');
  if (!root || document.body.dataset.page !== 'jugadores') return;

  if (!state.loaded) {
    attempts += 1;
    if (!state.error && attempts < 120) setTimeout(guardPlayerRoute, 50);
    return;
  }

  const params = new URLSearchParams(location.search);
  const playerId = Number(params.get('id'));
  const requestedTeamId = Number(params.get('team'));
  const memberships = seasonMemberships(playerId);
  const visibleTeamIds = filteredTeamIds();
  const visibleMembershipTeamIds = memberships
    .map(row => Number(row.equipo_id))
    .filter(teamId => visibleTeamIds.has(teamId));

  const resolution = resolvePlayerRouteContext({
    playerId,
    requestedTeamId,
    visibleMembershipTeamIds,
    membershipTeamIds: memberships.map(row => row.equipo_id)
  });

  if (resolution.status === 'current') return;

  if (resolution.status === 'team') {
    if (!applyTeamContext(resolution.teamId, resolution.playerId)) {
      renderRouteError(root, 'Contexto de jugador no disponible', 'El equipo asociado no está disponible en esta temporada.');
    }
    return;
  }

  if (resolution.status === 'ambiguous') {
    const choiceSet = new Set(resolution.choices || []);
    const choices = memberships.filter(row => choiceSet.has(Number(row.equipo_id)));
    renderRouteError(
      root,
      'Elegí el equipo del jugador',
      'Este jugador tiene más de un plantel posible para este enlace. Para no mezclar estadísticas, elegí el contexto correcto.',
      choices,
      resolution.playerId
    );
    return;
  }

  if (resolution.status === 'invalid-team') {
    renderRouteError(root, 'Contexto de jugador inválido', 'El jugador no pertenece al equipo indicado en este enlace.');
    return;
  }

  renderRouteError(root, 'Jugador no disponible', 'No encontramos el jugador solicitado en la temporada actual.');
}

guardPlayerRoute();
