import {
  state, getBaseClub, getClubs, getClubsForTeamIds, getPlayersForTeamIds,
  getMatchesForTeamIds, getMatchParticipations, getTeam, teamCode, teamDisplayName
} from './store.js';
import { SEASON_ID } from './config.js';
import {
  esc, initials, formatDateISO, formatShortDate, localISODate, metric,
  normalizeText, bySpanishName, plural, safeHttpUrl
} from './utils.js';
import { clubBadge, icon } from './ui.js';

const CATEGORY_ORDER = ['infantiles', 'menores', 'cadetes', 'juveniles', 'juniors', 'mayores'];

function pageFile() {
  return location.pathname.split('/').filter(Boolean).pop() || 'index.html';
}

function categoryRank(value) {
  let key = normalizeText(value).replace(/[^a-z]/g, '');
  if (key === 'infantil') key = 'infantiles';
  if (key === 'menor') key = 'menores';
  if (key === 'cadete') key = 'cadetes';
  if (key === 'juvenil') key = 'juveniles';
  if (key === 'junior') key = 'juniors';
  if (key === 'mayor') key = 'mayores';
  const index = CATEGORY_ORDER.indexOf(key);
  return index === -1 ? 999 : index;
}

function categoryLabel(value) {
  const key = normalizeText(value).replace(/[^a-z]/g, '');
  const map = {
    infantil: 'Infantiles', infantiles: 'Infantiles', menor: 'Menores', menores: 'Menores',
    cadete: 'Cadetes', cadetes: 'Cadetes', juvenil: 'Juveniles', juveniles: 'Juveniles',
    junior: 'Juniors', juniors: 'Juniors', mayor: 'Mayores', mayores: 'Mayores'
  };
  return map[key] || value || 'Categoría';
}

function branchLabel(value) {
  if (value === 'M') return 'Masculino';
  if (value === 'F') return 'Femenino';
  return value || 'Rama';
}

function qs(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

function competitionParams(team) {
  return {
    rama: team?.rama || '',
    categoria: team?.categoria || '',
    division: team?.division || ''
  };
}

function competitionHref(team, page = 'posiciones.html') {
  const query = qs(competitionParams(team));
  return `${page}${query ? `?${query}` : ''}`;
}

function clubHref(row) {
  const team = Number(row?.teamId ?? row?.id_team ?? NaN);
  const baseId = Number(row?.clubId ?? row?.id ?? NaN);
  const values = { id: Number.isFinite(baseId) ? baseId : '' };
  if (Number.isFinite(team)) values.team = team;
  if (row?.branch || row?.rama) values.rama = row.branch || row.rama;
  if (row?.category || row?.categoria) values.categoria = row.category || row.categoria;
  if (row?.division) values.division = row.division;
  return `club.html?${qs(values)}`;
}

function matchSortKey(match) {
  return `${match?.date || ''}${match?.time || ''}`;
}

function resultForTeam(match, teamId) {
  if (match.status !== 'Finalizado') return null;
  const home = Number(match.homeTeamId) === Number(teamId);
  const own = home ? Number(match.homeScore) : Number(match.awayScore);
  const opp = home ? Number(match.awayScore) : Number(match.homeScore);
  if (own > opp) return 'W';
  if (own < opp) return 'L';
  return 'D';
}

function resultDot(value) {
  if (!value) return '';
  const label = value === 'W' ? 'G' : value === 'D' ? 'E' : 'P';
  const title = value === 'W' ? 'Ganado' : value === 'D' ? 'Empatado' : 'Perdido';
  return `<span class="form-dot ${value.toLowerCase()}" title="${title}">${label}</span>`;
}

function teamRow(team) {
  const base = getBaseClub(team.club_id) || { id: team.club_id, name: team.nombre_femebal || 'Club', abbr: initials(team.nombre_femebal || '7M') };
  return {
    ...base,
    id: Number(base.id),
    clubId: Number(base.id),
    teamId: Number(team.id),
    teamCode: teamCode(team),
    name: teamDisplayName(team, base),
    branch: team.rama || '',
    category: team.categoria || '',
    division: team.division || ''
  };
}

function matchMini(match) {
  const home = getBaseClub(match.homeClubId) || { id: match.homeClubId, name: match.home, abbr: initials(match.home) };
  const away = getBaseClub(match.awayClubId) || { id: match.awayClubId, name: match.away, abbr: initials(match.away) };
  const date = formatShortDate(match.date);
  const center = match.status === 'Finalizado' ? `${match.homeScore}–${match.awayScore}` : (match.time || 'VS');
  return `<a class="feature-match-row" href="partido.html?id=${match.id}">
    <span class="feature-match-date"><b>${date.day}</b><small>${date.month}</small></span>
    <span class="feature-match-team">${clubBadge(home, true)}<b>${esc(match.home)}</b></span>
    <strong>${esc(center)}</strong>
    <span class="feature-match-team away"><b>${esc(match.away)}</b>${clubBadge(away, true)}</span>
  </a>`;
}

function injectCompetitionNav() {
  const nav = document.querySelector('.sidebar .nav');
  if (!nav || nav.querySelector('[data-nav-competitions]')) return;
  const home = nav.querySelector('a[href="index.html"]');
  const link = document.createElement('a');
  link.className = `nav-link ${pageFile() === 'competiciones.html' ? 'active' : ''}`;
  link.href = 'competiciones.html';
  link.dataset.navCompetitions = '1';
  link.innerHTML = `<span class="nav-icon">${icon('ball')}</span><span>Competiciones</span>`;
  if (home) home.insertAdjacentElement('afterend', link);
  else nav.prepend(link);
}

function enhanceHome() {
  if (pageFile() !== 'index.html' && pageFile() !== '') return;
  const actions = document.querySelector('.hero-actions');
  if (actions && !actions.querySelector('[data-competition-directory]')) {
    const a = document.createElement('a');
    a.className = 'btn ghost';
    a.href = 'competiciones.html';
    a.dataset.competitionDirectory = '1';
    a.innerHTML = `${icon('ball')}Competiciones`;
    actions.appendChild(a);
  }
}

function enhanceTeamLinks() {
  const rows = getClubs();
  document.querySelectorAll('a[href^="club.html?id="]').forEach(anchor => {
    let url;
    try { url = new URL(anchor.getAttribute('href'), location.href); } catch { return; }
    if (url.searchParams.has('team')) return;
    const id = Number(url.searchParams.get('id'));
    if (!Number.isFinite(id)) return;
    const candidates = rows.filter(row => Number(row.id) === id);
    if (!candidates.length) return;
    const text = normalizeText(anchor.textContent || '');
    let candidate = candidates
      .slice()
      .sort((a, b) => normalizeText(b.name).length - normalizeText(a.name).length)
      .find(row => text.includes(normalizeText(row.name)));
    if (!candidate && candidates.length === 1) candidate = candidates[0];
    if (!candidate) return;
    anchor.href = clubHref(candidate);
  });
}

function renderCompetitionDirectory() {
  const root = document.getElementById('competition-directory');
  if (!root) return;

  const teams = state.teams.filter(team => Number(team.temporada_id) === SEASON_ID && team.activo !== false);
  const groups = new Map();
  teams.forEach(team => {
    const key = [team.rama, team.categoria, team.division].join('|||');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(team);
  });

  const entries = [...groups.entries()].map(([key, groupTeams]) => {
    const [rama, categoria, division] = key.split('|||');
    const ids = new Set(groupTeams.map(team => Number(team.id)));
    const matches = getMatchesForTeamIds(ids);
    const finished = matches.filter(match => match.status === 'Finalizado').length;
    return { rama, categoria, division, teams: groupTeams, matches, finished };
  }).sort((a, b) =>
    String(a.rama).localeCompare(String(b.rama)) ||
    categoryRank(a.categoria) - categoryRank(b.categoria) ||
    bySpanishName(a.division, b.division)
  );

  const renderBranch = rama => {
    const items = entries.filter(entry => entry.rama === rama);
    if (!items.length) return '';
    return `<section class="competition-branch-section">
      <div class="competition-branch-head"><div><span class="section-kicker">RAMA</span><h2>${branchLabel(rama)}</h2></div><span>${plural(items.length, 'competición', 'competiciones')}</span></div>
      <div class="competition-directory-grid">${items.map(entry => {
        const href = `posiciones.html?${qs({ rama: entry.rama, categoria: entry.categoria, division: entry.division })}`;
        const gamesHref = `partidos.html?${qs({ rama: entry.rama, categoria: entry.categoria, division: entry.division })}`;
        return `<article class="card competition-directory-card">
          <div class="competition-card-top"><span class="competition-branch-pill">${entry.rama === 'F' ? 'FEMENINO' : 'MASCULINO'}</span><span>${categoryLabel(entry.categoria)}</span></div>
          <h3>${esc(entry.division)}</h3>
          <div class="competition-card-metrics"><span><b>${entry.teams.length}</b>equipos</span><span><b>${entry.matches.length}</b>partidos</span><span><b>${entry.finished}</b>finalizados</span></div>
          <div class="competition-card-actions"><a class="btn gold" href="${href}">Posiciones</a><a class="btn light" href="${gamesHref}">Partidos</a></div>
        </article>`;
      }).join('')}</div>
    </section>`;
  };

  root.innerHTML = `${renderBranch('M')}${renderBranch('F')}` || `<div class="empty-state"><b>Sin competiciones</b><p>No encontramos equipos para la temporada seleccionada.</p></div>`;

  const total = document.getElementById('competition-directory-count');
  if (total) total.textContent = `${entries.length} competiciones · ${teams.length} equipos`;
}

function teamSwitcher(allTeams, selectedTeam) {
  const sorted = allTeams.slice().sort((a, b) =>
    String(a.rama).localeCompare(String(b.rama)) ||
    categoryRank(a.categoria) - categoryRank(b.categoria) ||
    bySpanishName(a.division, b.division) ||
    teamCode(a).localeCompare(teamCode(b))
  );
  return `<div class="team-directory">${sorted.map(team => {
    const row = teamRow(team);
    const selected = Number(team.id) === Number(selectedTeam?.id);
    return `<a class="team-directory-item ${selected ? 'active' : ''}" href="${clubHref(row)}">
      <span>${team.rama === 'F' ? 'F' : 'M'}</span>
      <div><b>${categoryLabel(team.categoria)} · ${esc(team.division)}</b><small>${teamCode(team) === 'A' ? 'Equipo A' : `Equipo ${esc(teamCode(team))}`}</small></div>
      <strong>›</strong>
    </a>`;
  }).join('')}</div>`;
}

function renderClubProfile() {
  if (pageFile() !== 'club.html') return;
  const root = document.getElementById('club-detail');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const clubId = Number(params.get('id'));
  const requestedTeamId = Number(params.get('team'));
  const baseClub = getBaseClub(clubId);
  if (!baseClub) return;

  const allTeams = state.teams.filter(team => Number(team.temporada_id) === SEASON_ID && Number(team.club_id) === clubId && team.activo !== false);
  let selectedTeam = allTeams.find(team => Number(team.id) === requestedTeamId) || null;
  if (!selectedTeam) {
    const current = getClubs().find(row => Number(row.id) === clubId);
    selectedTeam = allTeams.find(team => Number(team.id) === Number(current?.teamId)) || allTeams.find(team => teamCode(team) === 'A') || allTeams[0] || null;
  }
  if (!selectedTeam) return;

  const selectedSet = new Set([Number(selectedTeam.id)]);
  const teamStats = getClubsForTeamIds(selectedSet)[0] || teamRow(selectedTeam);
  const players = getPlayersForTeamIds(selectedSet).sort((a, b) => b.goals - a.goals || bySpanishName(a.name, b.name));
  const matches = getMatchesForTeamIds(selectedSet).slice().sort((a, b) => matchSortKey(b).localeCompare(matchSortKey(a)));
  const finished = matches.filter(match => match.status === 'Finalizado');
  const future = matches.filter(match => match.status !== 'Finalizado' && match.date >= localISODate()).sort((a, b) => matchSortKey(a).localeCompare(matchSortKey(b)));
  const planillas = matches.filter(match => safeHttpUrl(match.planillaUrl)).length;
  const programaciones = matches.filter(match => safeHttpUrl(match.raw?.programacion_pdf_url || match.raw?.programacion_url)).length;
  const form = finished.slice(0, 5).reverse().map(match => resultForTeam(match, selectedTeam.id));
  const selectedName = teamDisplayName(selectedTeam, baseClub);
  const positionsHref = competitionHref(selectedTeam, 'posiciones.html');
  const matchesHref = competitionHref(selectedTeam, 'partidos.html');

  const header = document.querySelector('.page-header h1');
  const sub = document.querySelector('.page-header p');
  if (header) header.textContent = selectedName;
  if (sub) sub.textContent = `${branchLabel(selectedTeam.rama)} · ${categoryLabel(selectedTeam.categoria)} · ${selectedTeam.division}`;
  document.title = `${selectedName} — 7Metros`;

  root.innerHTML = `
    <section class="card pro-club-hero">
      <div class="pro-club-identity">${clubBadge(baseClub)}<div><span class="section-kicker">${esc(baseClub.city || 'CLUB FEMEBAL')}</span><h2>${esc(baseClub.name)}</h2><p>${teamCode(selectedTeam) === 'A' ? 'Equipo A' : `Equipo ${esc(teamCode(selectedTeam))}`} · ${categoryLabel(selectedTeam.categoria)} · ${esc(selectedTeam.division)} · ${branchLabel(selectedTeam.rama)}</p><div class="pro-club-actions"><a class="btn gold" href="${positionsHref}">Ver posiciones</a><a class="btn light" href="${matchesHref}">Ver competencia</a></div></div></div>
      <div class="pro-club-scoreboard"><div><small>PTS</small><b>${teamStats.points ?? 0}</b></div><div><small>PJ</small><b>${teamStats.played ?? 0}</b></div><div><small>PG</small><b>${teamStats.won ?? 0}</b></div><div><small>PE</small><b>${teamStats.drawn ?? 0}</b></div><div><small>PP</small><b>${teamStats.lost ?? 0}</b></div><div><small>DIF</small><b>${(teamStats.gd ?? 0) > 0 ? '+' : ''}${teamStats.gd ?? 0}</b></div></div>
    </section>

    <section class="feature-grid two-thirds">
      <article class="card feature-panel"><div class="feature-panel-head"><div><span class="section-kicker">EQUIPO SELECCIONADO</span><h2>${esc(selectedName)}</h2></div><div class="form-dots">${form.map(resultDot).join('') || '<span class="muted-copy">Sin resultados</span>'}</div></div><div class="feature-match-list">${matches.slice(0, 6).map(matchMini).join('') || '<div class="feature-empty">No hay partidos cargados para este equipo.</div>'}</div></article>
      <article class="card feature-panel"><div class="feature-panel-head"><div><span class="section-kicker">COBERTURA</span><h2>Calidad de datos</h2></div></div><div class="coverage-grid"><div><b>${matches.length}</b><span>partidos</span></div><div><b>${programaciones}</b><span>programaciones oficiales</span></div><div><b>${planillas}</b><span>planillas importadas</span></div><div><b>${players.length}</b><span>jugadores cargados</span></div></div><p class="coverage-note">7Metros diferencia información disponible de información todavía no importada: un dato ausente no se muestra como cero.</p></article>
    </section>

    <section class="feature-grid team-and-roster">
      <article class="card feature-panel"><div class="feature-panel-head"><div><span class="section-kicker">TODOS LOS EQUIPOS</span><h2>${allTeams.length} equipos / categorías 2026</h2></div></div>${teamSwitcher(allTeams, selectedTeam)}</article>
      <article class="card feature-panel"><div class="feature-panel-head"><div><span class="section-kicker">PLANTEL</span><h2>${players.length ? plural(players.length, 'jugador', 'jugadores') : 'Pendiente de planilla digital'}</h2></div></div>${players.length ? `<div class="feature-roster-list">${players.slice(0, 18).map(player => `<a href="jugador.html?id=${player.id}"><span class="dorsal">${esc(player.number)}</span><div><b>${esc(player.name)}</b><small>${esc(player.position)} · ${player.goals} goles · ${player.matchesPlayed} PJ</small></div><strong>›</strong></a>`).join('')}</div>` : `<div class="data-pending"><span>${icon('clipboard')}</span><div><b>Plantel todavía no importado</b><p>Los partidos y la identidad del equipo ya están cargados. Los jugadores se incorporarán desde las planillas digitales oficiales cuando podamos acceder a esa fuente de forma verificable.</p></div></div>`}</article>
    </section>

    ${future.length ? `<section class="card feature-panel"><div class="feature-panel-head"><div><span class="section-kicker">PRÓXIMO</span><h2>Próximo partido</h2></div></div>${matchMini(future[0])}</section>` : ''}`;
}

function participationPanel(rows, title, club, teamName) {
  if (!rows.length) return `<article class="card feature-panel participation-panel"><div class="feature-panel-head"><div>${clubBadge(club, true)}<div><span class="section-kicker">${esc(title)}</span><h2>${esc(teamName)}</h2></div></div></div><div class="data-pending compact"><span>${icon('clipboard')}</span><div><b>Planilla digital todavía no importada</b><p>No mostramos jugadores ni goleadores hasta contar con la fuente oficial de este partido.</p></div></div></article>`;
  const goals = rows.reduce((sum, row) => sum + Number(row.goals || 0), 0);
  return `<article class="card feature-panel participation-panel"><div class="feature-panel-head"><div>${clubBadge(club, true)}<div><span class="section-kicker">${esc(title)}</span><h2>${esc(teamName)}</h2></div></div><strong>${goals} goles</strong></div><div class="table-scroll"><table class="data-table compact"><thead><tr><th>#</th><th>JUGADOR</th><th>POS.</th><th>G</th><th>2MIN</th><th>TA</th><th>TR</th></tr></thead><tbody>${rows.map(row => `<tr><td><span class="dorsal">${esc(row.number)}</span></td><td><a href="jugador.html?id=${row.playerId}"><b>${esc(row.playerName)}</b></a></td><td>${esc(row.position)}</td><td><b>${row.goals}</b></td><td>${row.twoMin}</td><td>${row.yellow}</td><td>${row.red}</td></tr>`).join('')}</tbody></table></div></article>`;
}

function renderMatchProfile() {
  if (pageFile() !== 'partido.html') return;
  const root = document.getElementById('match-detail');
  if (!root) return;
  const id = Number(new URLSearchParams(location.search).get('id'));
  const match = state.index.matchById.get(id);
  if (!match) return;

  const homeTeam = getTeam(match.homeTeamId);
  const awayTeam = getTeam(match.awayTeamId);
  const homeClub = getBaseClub(match.homeClubId) || { id: match.homeClubId, name: match.home, abbr: initials(match.home) };
  const awayClub = getBaseClub(match.awayClubId) || { id: match.awayClubId, name: match.away, abbr: initials(match.away) };
  const homeName = homeTeam ? teamDisplayName(homeTeam, homeClub) : match.home;
  const awayName = awayTeam ? teamDisplayName(awayTeam, awayClub) : match.away;
  const homeRow = homeTeam ? teamRow(homeTeam) : { ...homeClub, teamId: match.homeTeamId, name: homeName };
  const awayRow = awayTeam ? teamRow(awayTeam) : { ...awayClub, teamId: match.awayTeamId, name: awayName };
  const homeRows = getMatchParticipations(match.id, match.homeTeamId);
  const awayRows = getMatchParticipations(match.id, match.awayTeamId);
  const planilla = safeHttpUrl(match.planillaUrl);
  const video = safeHttpUrl(match.videoUrl);
  const programacion = safeHttpUrl(match.raw?.programacion_pdf_url || match.raw?.programacion_url);
  const competition = homeTeam || awayTeam;

  const header = document.querySelector('.page-header h1');
  const sub = document.querySelector('.page-header p');
  if (header) header.textContent = `${homeName} vs ${awayName}`;
  if (sub) sub.textContent = `${match.roundLabel} · ${formatDateISO(match.date)}${match.time ? ` · ${match.time}` : ''}`;
  document.title = `${homeName} vs ${awayName} — 7Metros`;

  const sources = [
    programacion ? `<a class="source-action verified" href="${esc(programacion)}" target="_blank" rel="noopener noreferrer"><span>${icon('calendar')}</span><div><b>Programación oficial</b><small>Fe.Me.Bal. · PDF / fuente de fixture</small></div>${icon('external')}</a>` : '',
    planilla ? `<a class="source-action verified" href="${esc(planilla)}" target="_blank" rel="noopener noreferrer"><span>${icon('clipboard')}</span><div><b>Planilla digital</b><small>Jugadores, goles y sanciones</small></div>${icon('external')}</a>` : `<div class="source-action pending"><span>${icon('clipboard')}</span><div><b>Planilla digital</b><small>Todavía no importada en 7Metros</small></div></div>`,
    video ? `<a class="source-action" href="${esc(video)}" target="_blank" rel="noopener noreferrer"><span>${icon('ball')}</span><div><b>Video</b><small>Fuente audiovisual del partido</small></div>${icon('external')}</a>` : ''
  ].filter(Boolean).join('');

  root.innerHTML = `
    <section class="card pro-match-hero">
      <div class="pro-match-context"><span>${competition ? `${categoryLabel(competition.categoria)} · ${esc(competition.division)} · ${branchLabel(competition.rama)}` : 'Competencia FEMEBAL'}</span><b>${esc(match.roundLabel)}</b><small>${formatDateISO(match.date)}${match.time ? ` · ${esc(match.time)}` : ''}</small></div>
      <div class="pro-match-team home">${clubBadge(homeClub)}<a href="${clubHref(homeRow)}">${esc(homeName)}</a>${homeTeam && teamCode(homeTeam) !== 'A' ? `<span class="team-code">${esc(teamCode(homeTeam))}</span>` : ''}</div>
      <div class="pro-match-score"><strong>${match.status === 'Finalizado' ? `${match.homeScore}<i>–</i>${match.awayScore}` : 'VS'}</strong><span class="status-pill ${match.status === 'Finalizado' ? '' : 'gold'}">${esc(match.status.toUpperCase())}</span></div>
      <div class="pro-match-team away">${clubBadge(awayClub)}<a href="${clubHref(awayRow)}">${esc(awayName)}</a>${awayTeam && teamCode(awayTeam) !== 'A' ? `<span class="team-code">${esc(teamCode(awayTeam))}</span>` : ''}</div>
    </section>
    <section class="source-grid">${sources}</section>
    ${match.notes ? `<section class="card match-note-feature"><span>${icon('info')}</span><p>${esc(match.notes)}</p></section>` : ''}
    <section class="match-participation-grid">${participationPanel(homeRows, 'LOCAL', homeClub, homeName)}${participationPanel(awayRows, 'VISITANTE', awayClub, awayName)}</section>
    <section class="card traceability-feature"><span>${icon('database')}</span><div><span class="section-kicker">TRAZABILIDAD</span><h2>Resultado → equipo → planilla → video</h2><p>La ficha separa lo confirmado de lo todavía no importado. Cuando la planilla digital esté disponible, 7Metros podrá enlazar jugadores, goles y sanciones con la fuente original y, más adelante, con eventos de video.</p></div></section>`;
}

function enhanceStandings() {
  if (pageFile() !== 'posiciones.html') return;
  const table = document.getElementById('standings-body')?.closest('.card, .table-scroll, section');
  if (!table || document.querySelector('[data-standings-summary]')) return;
  const teams = getClubs();
  const ids = new Set(teams.map(row => Number(row.teamId)).filter(Number.isFinite));
  const matches = getMatchesForTeamIds(ids);
  const finished = matches.filter(match => match.status === 'Finalizado').length;
  const bar = document.createElement('div');
  bar.className = 'competition-summary-bar';
  bar.dataset.standingsSummary = '1';
  bar.innerHTML = `<span><b>${teams.length}</b> equipos</span><span><b>${matches.length}</b> partidos</span><span><b>${finished}</b> finalizados</span><a href="partidos.html?${qs(state.filters)}">Ver calendario →</a>`;
  table.parentElement?.insertBefore(bar, table);
}

export function enhanceCurrentPage() {
  if (!state.loaded) return;
  injectCompetitionNav();
  enhanceHome();
  renderCompetitionDirectory();
  renderClubProfile();
  renderMatchProfile();
  enhanceStandings();
  enhanceTeamLinks();
}
