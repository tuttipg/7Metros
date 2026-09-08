import {
  state, getPlayers, getPlayer, getPlayerMatchRows, getClubs, getClub, getMatches, getBaseClub,
  getMatch, getMatchParticipations, getStandings, dataSummary, filteredTeams
} from './store.js';
import {
  esc, initials, formatDateISO, formatShortDate, localISODate, metric, ageFromBirthDate,
  safeHttpUrl, normalizeText, bySpanishName, plural
} from './utils.js';
import { clubBadge, icon, dataFreshnessLabel } from './ui.js';

function emptyState(title, text = '', action = '') {
  return `<div class="empty-state"><span class="empty-icon">${icon('info')}</span><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

function resultPill(value) {
  if (!value) return '';
  const label = value === 'W' ? 'G' : value === 'D' ? 'E' : 'P';
  return `<span class="form-dot ${value.toLowerCase()}" title="${value === 'W' ? 'Ganado' : value === 'D' ? 'Empatado' : 'Perdido'}">${label}</span>`;
}

function clubLink(club) {
  if (!club) return '—';
  return `<a class="inline-club" href="club.html?id=${club.id}">${clubBadge(club, true)}<span>${esc(club.name)}</span></a>`;
}

function playerLink(player) {
  return `<a class="player-cell-link" href="jugador.html?id=${player.id}"><span class="avatar">${esc(initials(player.name))}</span><span><b>${esc(player.name)}</b><small>${esc(player.position || '')}</small></span></a>`;
}

function matchCard(match) {
  const homeClub = getBaseClub(match.homeClubId) || { id: match.homeClubId, name: match.home, abbr: initials(match.home) };
  const awayClub = getBaseClub(match.awayClubId) || { id: match.awayClubId, name: match.away, abbr: initials(match.away) };
  const d = formatShortDate(match.date);
  const isFinal = match.status === 'Finalizado';
  const middle = isFinal
    ? `<strong>${match.homeScore}<span>–</span>${match.awayScore}</strong><small>FINAL</small>`
    : `<strong class="vs">VS</strong><small>${esc(match.time || 'Horario a confirmar')}</small>`;

  return `<article class="card match-row">
    <div class="match-date-box"><span>${d.day}</span><small>${d.month}</small></div>
    <div class="match-meta"><b>${esc(match.roundLabel)}</b><small>${formatDateISO(match.date)}</small></div>
    <div class="match-team home">${clubBadge(homeClub, true)}<span>${esc(match.home)}</span></div>
    <div class="result">${middle}</div>
    <div class="match-team away"><span>${esc(match.away)}</span>${clubBadge(awayClub, true)}</div>
    <a class="match-link" href="partido.html?id=${match.id}" aria-label="Ver detalle de ${esc(match.home)} contra ${esc(match.away)}">Detalle →</a>
  </article>`;
}

function compactMatch(match) {
  const homeClub = getBaseClub(match.homeClubId) || { id: match.homeClubId, name: match.home, abbr: initials(match.home) };
  const awayClub = getBaseClub(match.awayClubId) || { id: match.awayClubId, name: match.away, abbr: initials(match.away) };
  const d = formatShortDate(match.date);
  const score = match.status === 'Finalizado' ? `${match.homeScore}–${match.awayScore}` : (match.time || 'VS');
  return `<a class="compact-match" href="partido.html?id=${match.id}"><span class="date-box"><b>${d.day}</b><small>${d.month}</small></span><span class="compact-team">${clubBadge(homeClub, true)}${esc(match.home)}</span><strong>${esc(score)}</strong><span class="compact-team right">${esc(match.away)}${clubBadge(awayClub, true)}</span></a>`;
}

function renderDashboard() {
  const summary = dataSummary();
  document.querySelector('[data-kpi="clubs"]')?.replaceChildren(document.createTextNode(metric(summary.clubs)));
  document.querySelector('[data-kpi="players"]')?.replaceChildren(document.createTextNode(metric(summary.players)));
  document.querySelector('[data-kpi="matches"]')?.replaceChildren(document.createTextNode(metric(summary.matches)));
  document.querySelector('[data-kpi="goals"]')?.replaceChildren(document.createTextNode(metric(summary.goals)));
  document.querySelector('[data-kpi="avgGoals"]')?.replaceChildren(document.createTextNode(summary.avgGoals === null ? '—' : metric(summary.avgGoals, 1)));

  const healthLabel = document.getElementById('data-health-label');
  const healthMeta = document.getElementById('data-health-meta');
  if (healthLabel) healthLabel.textContent = summary.matches ? 'Datos disponibles' : 'Sin partidos en este filtro';
  if (healthMeta) healthMeta.textContent = `${dataFreshnessLabel()} · ${summary.finished} finalizados`;

  const matches = getMatches();
  const finished = matches.filter(m => m.status === 'Finalizado').sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const upcoming = matches.filter(m => m.status !== 'Finalizado' && m.date >= localISODate()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const last = document.getElementById('dashboard-last');
  if (last) {
    const match = finished[0];
    if (!match) last.innerHTML = emptyState('Todavía no hay resultados', 'Los partidos finalizados aparecerán acá.');
    else {
      const home = getBaseClub(match.homeClubId) || { name: match.home, abbr: initials(match.home) };
      const away = getBaseClub(match.awayClubId) || { name: match.away, abbr: initials(match.away) };
      last.innerHTML = `<a class="featured-match" href="partido.html?id=${match.id}"><div class="featured-team">${clubBadge(home)}<b>${esc(match.home)}</b></div><div class="featured-score"><span>${esc(match.roundLabel)} · ${formatDateISO(match.date)}</span><strong>${match.homeScore}<i>–</i>${match.awayScore}</strong><small>FINALIZADO</small></div><div class="featured-team">${clubBadge(away)}<b>${esc(match.away)}</b></div></a>`;
    }
  }

  const next = document.getElementById('dashboard-next');
  if (next) next.innerHTML = upcoming.slice(0, 4).map(compactMatch).join('') || emptyState('No hay próximos partidos', 'No encontramos encuentros programados desde hoy.');

  const standingsRoot = document.getElementById('dashboard-standings');
  if (standingsRoot) {
    const standings = getStandings().slice(0, 6);
    standingsRoot.innerHTML = standings.length ? `<div class="mini-standings">${standings.map((club, i) => `<a href="club.html?id=${club.id}" class="mini-standing-row"><span class="standing-pos">${i + 1}</span>${clubBadge(club, true)}<b>${esc(club.name)}</b><span>${club.played} PJ</span><strong>${club.points} pts</strong></a>`).join('')}</div>` : emptyState('Sin posiciones', 'Se necesitan resultados cargados para calcular la tabla.');
  }

  const high = document.getElementById('dashboard-highlights');
  if (high) {
    const players = getPlayers();
    if (!players.length) high.innerHTML = emptyState('Sin estadísticas', 'Los líderes aparecerán al cargar participaciones.');
    else {
      const goals = players.slice().sort((a, b) => b.goals - a.goals)[0];
      const rate = players.filter(p => p.matchesPlayed > 0).slice().sort((a, b) => (b.goalsPerMatch || 0) - (a.goalsPerMatch || 0))[0] || goals;
      const played = players.slice().sort((a, b) => b.matchesPlayed - a.matchesPlayed)[0];
      const discipline = players.slice().sort((a, b) => b.sanctions - a.sanctions)[0];
      const cards = [
        [goals, 'GOLEADOR', goals?.goals ?? 0, 'goles'],
        [rate, 'GOLES / PARTIDO', rate?.goalsPerMatch ?? 0, 'promedio'],
        [played, 'MÁS PARTIDOS', played?.matchesPlayed ?? 0, 'partidos'],
        [discipline, 'SANCIONES', discipline?.sanctions ?? 0, 'totales']
      ];
      high.innerHTML = cards.map(([p, label, value, unit]) => `<a class="highlight-item" href="jugador.html?id=${p.id}"><span class="highlight-kicker">${label}</span><span class="avatar large">${esc(initials(p.name))}</span><b class="highlight-name">${esc(p.name)}</b><span class="highlight-club">${esc(p.club)}</span><strong class="highlight-number">${typeof value === 'number' && !Number.isInteger(value) ? metric(value, 1) : metric(value)}</strong><span class="highlight-unit">${unit}</span></a>`).join('');
    }
  }
}

function renderClubes() {
  const grid = document.getElementById('club-grid');
  if (!grid) return;
  const search = document.getElementById('club-search');
  const sort = document.getElementById('club-sort');
  const count = document.getElementById('club-count');

  if (search && !search.dataset.bound) { search.dataset.bound = '1'; search.addEventListener('input', renderClubes); }
  if (sort && !sort.dataset.bound) { sort.dataset.bound = '1'; sort.addEventListener('change', renderClubes); }

  const term = normalizeText(search?.value || '');
  let clubs = getClubs().filter(c => normalizeText(c.name).includes(term));
  const mode = sort?.value || 'points';
  clubs.sort((a, b) => mode === 'name' ? bySpanishName(a.name, b.name) : mode === 'goals' ? b.gf - a.gf : b.points - a.points || b.gd - a.gd || bySpanishName(a.name, b.name));

  if (count) count.textContent = plural(clubs.length, 'club', 'clubes');
  if (!clubs.length) { grid.innerHTML = emptyState('No encontramos clubes', term ? 'Probá con otra búsqueda.' : 'No hay clubes para estos filtros.'); return; }

  grid.innerHTML = clubs.map(club => `<a class="card club-card" href="club.html?id=${club.id}"><div class="club-card-head">${clubBadge(club)}<div><span class="mini-label">CLUB</span><h3>${esc(club.name)}</h3><p>${club.played} partidos · ${club.gf} GF · ${club.ga} GC</p></div></div><div class="club-card-stats"><span><b>${club.points}</b>Puntos</span><span><b>${club.players}</b>Jugadores</span><span><b>${club.gd >= 0 ? '+' : ''}${club.gd}</b>Diferencia</span></div><div class="club-card-form"><span>Forma</span><div>${club.form.length ? club.form.map(resultPill).join('') : '<small>Sin resultados</small>'}</div><strong>Ver club →</strong></div></a>`).join('');
}

function renderClubDetail() {
  const root = document.getElementById('club-detail');
  if (!root) return;
  const id = Number(new URLSearchParams(location.search).get('id'));
  const club = getClub(id) || getClubs()[0];
  if (!club) { root.innerHTML = emptyState('Club no disponible', 'No encontramos este club en la competencia seleccionada.', '<a class="btn" href="clubes.html">Volver a clubes</a>'); return; }

  const header = document.querySelector('.page-header h1');
  const sub = document.querySelector('.page-header p');
  if (header) header.textContent = club.name;
  if (sub) sub.textContent = `Ficha del club · ${club.played} partidos finalizados`;
  document.title = `${club.name} — 7Metros`;

  const players = getPlayers().filter(p => p.clubId === club.id).sort((a, b) => b.goals - a.goals || bySpanishName(a.name, b.name));
  const matches = getMatches().filter(m => m.homeClubId === club.id || m.awayClubId === club.id).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const positions = ['Arquero', 'Extremo', 'Lateral', 'Central', 'Pivote', 'Sin posición'];

  root.innerHTML = `
    <section class="card club-hero">
      <div class="club-hero-main">${clubBadge(club)}<div><span class="section-kicker">CLUB</span><h2>${esc(club.name)}</h2><div class="form-line"><span>Últimos resultados</span>${club.form.length ? club.form.map(resultPill).join('') : '<small>Sin resultados</small>'}</div></div></div>
      <div class="hero-stat-grid"><div><small>PTS</small><b>${club.points}</b></div><div><small>PJ</small><b>${club.played}</b></div><div><small>PG</small><b>${club.won}</b></div><div><small>GF</small><b>${club.gf}</b></div><div><small>GC</small><b>${club.ga}</b></div><div><small>DIF</small><b>${club.gd >= 0 ? '+' : ''}${club.gd}</b></div></div>
    </section>
    <section class="club-detail-grid">
      <article class="card section-card"><div class="section-head"><div><span class="section-kicker">RENDIMIENTO</span><h2>Goleadores del club</h2></div><a href="estadisticas.html">Estadísticas</a></div><div class="leader-list">${players.slice(0, 5).map((p, i) => `<a class="leader-row" href="jugador.html?id=${p.id}"><span class="rank">${i + 1}</span><span class="leader-name">${esc(p.name)}<small>#${esc(p.number)} · ${esc(p.position)}</small></span><span class="leader-value">${p.goals}<small>goles</small></span></a>`).join('') || emptyState('Sin participaciones', 'Todavía no hay estadísticas de jugadores para este club.')}</div></article>
      <article class="card section-card"><div class="section-head"><div><span class="section-kicker">CALENDARIO</span><h2>Últimos partidos</h2></div><a href="partidos.html">Ver todos</a></div><div>${matches.slice(0, 5).map(compactMatch).join('') || emptyState('Sin partidos', 'No hay encuentros para este club.')}</div></article>
    </section>
    <section class="card section-card roster-section"><div class="section-head"><div><span class="section-kicker">PLANTEL</span><h2>${players.length} jugadores</h2></div><a href="planteles.html">Ver planteles</a></div><div class="roster-grid compact-roster">${positions.map(pos => { const list = players.filter(p => p.position === pos); if (!list.length) return ''; return `<section class="position-column"><h3>${esc(pos.toUpperCase())}<span>${list.length}</span></h3>${list.map(p => `<a class="roster-player" href="jugador.html?id=${p.id}"><span class="avatar number">${esc(p.number)}</span><div><b>${esc(p.name)}</b><small>${p.goals} goles · ${p.matchesPlayed} PJ</small></div></a>`).join('')}</section>`; }).join('')}</div></section>`;
}

function renderJugadores() {
  const tbody = document.getElementById('players-body');
  if (!tbody) return;
  const search = document.getElementById('player-search');
  const clubSelect = document.getElementById('player-club');
  const positionSelect = document.getElementById('player-position');
  const sortSelect = document.getElementById('player-sort');
  const count = document.getElementById('player-count');

  if (clubSelect) {
    const current = clubSelect.value;
    const options = getClubs().slice().sort((a, b) => bySpanishName(a.name, b.name));
    clubSelect.innerHTML = '<option value="">Todos los clubes</option>' + options.map(c => `<option value="${c.id}" ${String(c.id) === current ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  }
  [[search, 'input'], [clubSelect, 'change'], [positionSelect, 'change'], [sortSelect, 'change']].forEach(([el, event]) => {
    if (el && !el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener(event, renderJugadores); }
  });

  const term = normalizeText(search?.value || '');
  const clubId = Number(clubSelect?.value || 0);
  const pos = positionSelect?.value || '';
  const mode = sortSelect?.value || 'goals';
  let players = getPlayers().filter(p => (!term || normalizeText(`${p.name} ${p.club}`).includes(term)) && (!clubId || p.clubId === clubId) && (!pos || p.position === pos));
  players.sort((a, b) => mode === 'name' ? bySpanishName(a.name, b.name) : mode === 'matches' ? b.matchesPlayed - a.matchesPlayed || b.goals - a.goals : b.goals - a.goals || b.matchesPlayed - a.matchesPlayed);
  if (count) count.textContent = plural(players.length, 'jugador', 'jugadores');

  tbody.innerHTML = players.map(p => `<tr><td>${playerLink(p)}</td><td><a href="club.html?id=${p.clubId}">${esc(p.club)}</a></td><td><span class="dorsal">${esc(p.number)}</span></td><td><span class="tag">${esc(p.position)}</span></td><td>${p.matchesPlayed}</td><td><b>${p.goals}</b></td><td>${p.goalsPerMatch === null ? '—' : metric(p.goalsPerMatch, 1)}</td><td>${p.sanctions}</td><td><a class="row-action" href="jugador.html?id=${p.id}">Ver →</a></td></tr>`).join('') || `<tr><td colspan="9">${emptyState('No encontramos jugadores', term ? 'Probá con otros filtros.' : 'No hay planteles cargados para esta selección.')}</td></tr>`;
}

function renderPlayerDetail() {
  const root = document.getElementById('player-detail');
  if (!root) return;
  const id = Number(new URLSearchParams(location.search).get('id'));
  const player = getPlayer(id) || getPlayers()[0];
  if (!player) { root.innerHTML = emptyState('Jugador no disponible', 'No encontramos este jugador en la competencia seleccionada.'); return; }
  const age = ageFromBirthDate(player.birthDate);
  const rows = getPlayerMatchRows(player.id);
  const club = getClub(player.clubId) || { id: player.clubId, name: player.club, abbr: initials(player.club) };
  const header = document.querySelector('.page-header h1');
  const sub = document.querySelector('.page-header p');
  if (header) header.textContent = player.name;
  if (sub) sub.textContent = `${player.club} · ${player.position}`;
  document.title = `${player.name} — 7Metros`;

  const recent = rows.slice(0, 8);
  const maxGoals = Math.max(1, ...recent.map(r => r.goals));
  root.innerHTML = `
    <section class="card player-hero">
      <div class="player-identity"><span class="player-avatar-xl">${esc(initials(player.name))}</span><div><span class="section-kicker">JUGADOR</span><h2>${esc(player.name)}</h2><a class="player-club-link" href="club.html?id=${club.id}">${clubBadge(club, true)}${esc(player.club)}</a><div class="player-tags"><span>#${esc(player.number)}</span><span>${esc(player.position)}</span>${player.dominantArm ? `<span>Brazo ${esc(player.dominantArm)}</span>` : ''}</div></div></div>
      <div class="player-bio">${age !== null ? `<div><small>EDAD</small><b>${age}</b></div>` : ''}${player.height ? `<div><small>ALTURA</small><b>${player.height} cm</b></div>` : ''}${player.weight ? `<div><small>PESO</small><b>${player.weight} kg</b></div>` : ''}</div>
    </section>
    <section class="player-kpi-grid">
      <article class="card player-kpi"><span>PJ</span><b>${player.matchesPlayed}</b><small>partidos registrados</small></article>
      <article class="card player-kpi featured"><span>GOLES</span><b>${player.goals}</b><small>total temporada</small></article>
      <article class="card player-kpi"><span>G / PARTIDO</span><b>${player.goalsPerMatch === null ? '—' : metric(player.goalsPerMatch, 1)}</b><small>promedio</small></article>
      <article class="card player-kpi"><span>SANCIONES</span><b>${player.sanctions}</b><small>${player.twoMin}×2min · ${player.red} rojas</small></article>
    </section>
    <section class="player-detail-grid">
      <article class="card section-card"><div class="section-head"><div><span class="section-kicker">FORMA RECIENTE</span><h2>Goles por partido</h2></div></div>${recent.length ? `<div class="spark-bars">${recent.slice().reverse().map(r => `<a href="partido.html?id=${r.match.id}" class="spark-item" title="${esc(r.match.home)} vs ${esc(r.match.away)}: ${r.goals} goles"><div class="spark-track"><span style="--h:${Math.max(8, Math.round((r.goals / maxGoals) * 100))}%"></span></div><b>${r.goals}</b><small>${formatShortDate(r.match.date).day}/${new Date(`${r.match.date}T12:00:00`).getMonth()+1}</small></a>`).join('')}</div>` : emptyState('Sin partidos', 'No hay participaciones recientes para graficar.')}</article>
      <article class="card section-card"><div class="section-head"><div><span class="section-kicker">DISCIPLINA</span><h2>Sanciones</h2></div></div><div class="discipline-grid"><div><span class="tag gold">2 MIN</span><b>${player.twoMin}</b></div><div><span class="tag yellow">AMARILLAS</span><b>${player.yellow}</b></div><div><span class="tag red">ROJAS</span><b>${player.red}</b></div></div></article>
    </section>
    <section class="card section-card"><div class="section-head"><div><span class="section-kicker">PARTIDOS</span><h2>Rendimiento reciente</h2></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>FECHA</th><th>PARTIDO</th><th>RESULTADO</th><th>GOLES</th><th>2MIN</th><th></th></tr></thead><tbody>${recent.map(r => { const m = r.match; const score = m.status === 'Finalizado' ? `${m.homeScore}–${m.awayScore}` : 'Programado'; return `<tr><td>${formatDateISO(m.date)}</td><td><b>${esc(m.home)}</b> vs ${esc(m.away)}</td><td>${score}</td><td><b>${r.goals}</b></td><td>${r.twoMin}</td><td><a class="row-action" href="partido.html?id=${m.id}">Ver partido →</a></td></tr>`; }).join('') || `<tr><td colspan="6">${emptyState('Sin participaciones', 'Todavía no hay partidos asociados a este jugador.')}</td></tr>`}</tbody></table></div></section>
    <section class="card advanced-player-teaser"><div class="teaser-target">${icon('goal')}</div><div><span class="section-kicker">PRÓXIMAMENTE CON VIDEO</span><h2>Mapa de lanzamiento, zonas y clips</h2><p>La ficha está preparada para incorporar tiros, efectividad, ubicación en cancha y acceso al timestamp del video cuando el pipeline de IA genere esos eventos.</p></div></section>`;
}

function renderPlanteles() {
  const select = document.getElementById('roster-club');
  const root = document.getElementById('roster-wrap');
  if (!root || !select) return;
  const clubs = getClubs().slice().sort((a, b) => bySpanishName(a.name, b.name));
  const current = Number(select.value || 0);
  select.innerHTML = clubs.map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  if (!select.dataset.bound) { select.dataset.bound = '1'; select.addEventListener('change', renderPlanteles); }
  if (!clubs.length) { root.innerHTML = emptyState('Sin planteles', 'No hay clubes disponibles con estos filtros.'); return; }
  const clubId = Number(select.value || clubs[0].id);
  if (!clubs.some(c => c.id === clubId)) select.value = String(clubs[0].id);
  const actualId = Number(select.value || clubs[0].id);
  const club = getClub(actualId) || clubs[0];
  const players = getPlayers().filter(p => p.clubId === actualId).sort((a, b) => Number(a.number || 999) - Number(b.number || 999));
  const positions = ['Arquero', 'Extremo', 'Lateral', 'Central', 'Pivote', 'Sin posición'];
  document.getElementById('roster-title').textContent = `Plantel — ${club.name}`;
  document.getElementById('roster-count').textContent = plural(players.length, 'jugador', 'jugadores');
  root.innerHTML = positions.map(pos => { const list = players.filter(p => p.position === pos); if (!list.length) return ''; return `<section class="card position-column"><h3>${esc(pos.toUpperCase())}<span>${list.length}</span></h3>${list.map(p => `<a class="roster-player" href="jugador.html?id=${p.id}"><span class="avatar number">${esc(p.number)}</span><div><b>${esc(p.name)}</b><small>${p.goals} goles · ${p.matchesPlayed} PJ</small></div><span class="row-chevron">›</span></a>`).join('')}</section>`; }).join('') || emptyState('Plantel vacío', 'No hay jugadores cargados para este club.');
}

function renderPartidos() {
  const root = document.getElementById('matches-list');
  if (!root) return;
  const status = document.getElementById('match-status');
  const clubSelect = document.getElementById('match-club');
  const order = document.getElementById('match-order');
  const count = document.getElementById('match-count');
  if (clubSelect) {
    const current = clubSelect.value;
    clubSelect.innerHTML = '<option value="">Todos los clubes</option>' + getClubs().slice().sort((a,b)=>bySpanishName(a.name,b.name)).map(c => `<option value="${c.id}" ${String(c.id) === current ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  }
  [[status, 'change'], [clubSelect, 'change'], [order, 'change']].forEach(([el, ev]) => { if (el && !el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener(ev, renderPartidos); } });
  const statusValue = status?.value || '';
  const clubId = Number(clubSelect?.value || 0);
  let matches = getMatches().filter(m => (!statusValue || m.status === statusValue) && (!clubId || m.homeClubId === clubId || m.awayClubId === clubId));
  const dir = order?.value || 'desc';
  matches.sort((a,b) => dir === 'asc' ? `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) : `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  if (count) count.textContent = plural(matches.length, 'partido', 'partidos');
  root.innerHTML = matches.map(matchCard).join('') || emptyState('No hay partidos', 'No encontramos encuentros con estos filtros.');
}

function participationTable(rows, title, club) {
  const total = rows.reduce((sum, r) => sum + r.goals, 0);
  return `<article class="card section-card match-team-stats"><div class="section-head"><div>${clubBadge(club, true)}<div><span class="section-kicker">${esc(title)}</span><h2>${esc(club.name)}</h2></div></div><span>${total} goles en planilla</span></div><div class="table-scroll"><table class="data-table compact"><thead><tr><th>#</th><th>JUGADOR</th><th>POS.</th><th>G</th><th>2MIN</th><th>TA</th><th>TR</th></tr></thead><tbody>${rows.map(r => `<tr><td><span class="dorsal">${esc(r.number)}</span></td><td><a href="jugador.html?id=${r.playerId}"><b>${esc(r.playerName)}</b></a></td><td>${esc(r.position)}</td><td><b>${r.goals}</b></td><td>${r.twoMin}</td><td>${r.yellow}</td><td>${r.red}</td></tr>`).join('') || `<tr><td colspan="7">${emptyState('Sin detalle de jugadores', 'No hay participaciones asociadas a este equipo en el partido.')}</td></tr>`}</tbody></table></div></article>`;
}

function renderMatchDetail() {
  const root = document.getElementById('match-detail');
  if (!root) return;
  const id = Number(new URLSearchParams(location.search).get('id'));
  const match = getMatch(id) || getMatches()[0];
  if (!match) { root.innerHTML = emptyState('Partido no disponible', 'No encontramos este partido en la competencia seleccionada.'); return; }
  const home = getBaseClub(match.homeClubId) || { id: match.homeClubId, name: match.home, abbr: initials(match.home) };
  const away = getBaseClub(match.awayClubId) || { id: match.awayClubId, name: match.away, abbr: initials(match.away) };
  const homeRows = getMatchParticipations(match.id, match.homeTeamId);
  const awayRows = getMatchParticipations(match.id, match.awayTeamId);
  const planilla = safeHttpUrl(match.planillaUrl);
  const video = safeHttpUrl(match.videoUrl);
  const header = document.querySelector('.page-header h1');
  const sub = document.querySelector('.page-header p');
  if (header) header.textContent = `${match.home} vs ${match.away}`;
  if (sub) sub.textContent = `${match.roundLabel} · ${formatDateISO(match.date)}${match.time ? ` · ${match.time}` : ''}`;
  document.title = `${match.home} vs ${match.away} — 7Metros`;

  const sourceActions = [
    planilla ? `<a class="btn light" href="${esc(planilla)}" target="_blank" rel="noopener noreferrer">${icon('clipboard')}Planilla oficial${icon('external')}</a>` : '',
    video ? `<a class="btn light" href="${esc(video)}" target="_blank" rel="noopener noreferrer">${icon('ball')}Ver video${icon('external')}</a>` : ''
  ].filter(Boolean).join('');

  root.innerHTML = `
    <section class="card match-hero">
      <div class="match-hero-meta"><span>${esc(match.roundLabel)}</span><b>${formatDateISO(match.date)}</b><small>${esc(match.time || 'Horario no informado')}</small></div>
      <div class="match-hero-team home">${clubBadge(home)}<a href="club.html?id=${home.id}">${esc(match.home)}</a></div>
      <div class="match-hero-score"><strong>${match.status === 'Finalizado' ? `${match.homeScore}<i>–</i>${match.awayScore}` : '<span class="vs">VS</span>'}</strong><span class="status-pill ${match.status === 'Finalizado' ? '' : 'gold'}">${esc(match.status.toUpperCase())}</span></div>
      <div class="match-hero-team away">${clubBadge(away)}<a href="club.html?id=${away.id}">${esc(match.away)}</a></div>
    </section>
    ${(sourceActions || match.notes) ? `<section class="match-source-row">${sourceActions}<div class="source-note"><span>${icon('info')}</span><p>${match.notes ? esc(match.notes) : 'Las fuentes vinculadas permiten volver al documento o video original del partido.'}</p></div></section>` : ''}
    <section class="match-stats-grid">${participationTable(homeRows, 'LOCAL', home)}${participationTable(awayRows, 'VISITANTE', away)}</section>
    <section class="card section-card traceability-card"><div class="trace-icon">${icon('database')}</div><div><span class="section-kicker">TRAZABILIDAD 7METROS</span><h2>Partido → participación → fuente</h2><p>Esta ficha conserva la relación entre el resultado, los jugadores registrados y las fuentes disponibles. El mismo principio se usará para enlazar eventos de IA con timestamps de video.</p></div></section>`;
}

function renderStandings() {
  const tbody = document.getElementById('standings-body');
  if (!tbody) return;
  const standings = getStandings();
  tbody.innerHTML = standings.map((c, i) => `<tr><td><span class="standing-pos ${i < 3 ? 'top' : ''}">${i + 1}</span></td><td>${clubLink(c)}</td><td>${c.played}</td><td>${c.won}</td><td>${c.drawn}</td><td>${c.lost}</td><td>${c.gf}</td><td>${c.ga}</td><td><b class="gd ${c.gd > 0 ? 'positive' : c.gd < 0 ? 'negative' : ''}">${c.gd > 0 ? '+' : ''}${c.gd}</b></td><td><strong class="points">${c.points}</strong></td><td><div class="form-dots">${c.form.map(resultPill).join('') || '—'}</div></td></tr>`).join('') || `<tr><td colspan="11">${emptyState('Sin posiciones', 'Se necesitan clubes y resultados finalizados para calcular la tabla.')}</td></tr>`;
}

function renderParticipaciones() {
  const tbody = document.getElementById('participations-body');
  if (!tbody) return;
  const search = document.getElementById('participation-search');
  const count = document.getElementById('participation-count');
  if (search && !search.dataset.bound) { search.dataset.bound = '1'; search.addEventListener('input', renderParticipaciones); }
  const term = normalizeText(search?.value || '');
  const players = getPlayers().filter(p => !term || normalizeText(`${p.name} ${p.club}`).includes(term)).sort((a,b) => b.goals - a.goals || b.matchesPlayed - a.matchesPlayed);
  if (count) count.textContent = plural(players.length, 'jugador', 'jugadores');
  tbody.innerHTML = players.map((p,i) => `<tr><td>${i+1}</td><td>${playerLink(p)}</td><td><a href="club.html?id=${p.clubId}">${esc(p.club)}</a></td><td>${p.matchesPlayed}</td><td><b>${p.goals}</b></td><td>${p.goalsPerMatch === null ? '—' : metric(p.goalsPerMatch,1)}</td><td>${p.twoMin}</td><td>${p.yellow}</td><td>${p.red}</td></tr>`).join('') || `<tr><td colspan="9">${emptyState('Sin participaciones', 'No hay registros disponibles para estos filtros.')}</td></tr>`;
}

function leaderRows(players, getter, formatter = value => metric(value), sub = p => p.club) {
  return players.slice(0,5).map((p,i) => `<a class="leader-row" href="jugador.html?id=${p.id}"><span class="rank">${i+1}</span><span class="leader-name">${esc(p.name)}<small>${esc(sub(p))}</small></span><span class="leader-value">${formatter(getter(p))}</span></a>`).join('') || emptyState('Sin datos', 'Todavía no hay registros para esta métrica.');
}

function renderStats() {
  const players = getPlayers();
  const goals = players.slice().sort((a,b)=>b.goals-a.goals);
  const rate = players.filter(p=>p.matchesPlayed>0).slice().sort((a,b)=>(b.goalsPerMatch||0)-(a.goalsPerMatch||0)||b.goals-a.goals);
  const played = players.slice().sort((a,b)=>b.matchesPlayed-a.matchesPlayed||b.goals-a.goals);
  const sanctions = players.slice().sort((a,b)=>b.sanctions-a.sanctions||b.twoMin-a.twoMin);
  const map = {
    'goals-list': leaderRows(goals,p=>p.goals,v=>`${metric(v)} <small>G</small>`),
    'rate-list': leaderRows(rate,p=>p.goalsPerMatch,v=>`${v===null?'—':metric(v,1)} <small>G/P</small>`),
    'played-list': leaderRows(played,p=>p.matchesPlayed,v=>`${metric(v)} <small>PJ</small>`),
    'sanctions-list': leaderRows(sanctions,p=>p.sanctions,v=>`${metric(v)} <small>S</small>`)
  };
  Object.entries(map).forEach(([id,html])=>{const el=document.getElementById(id);if(el)el.innerHTML=html;});

  const clubs = getClubs().slice().sort((a,b)=>b.gf-a.gf);
  const goalsChart = document.getElementById('club-goals-chart');
  if (goalsChart) {
    const max = Math.max(1,...clubs.map(c=>c.gf));
    goalsChart.innerHTML = clubs.map(c=>`<a class="bar-row" href="club.html?id=${c.id}"><span>${esc(c.name)}</span><div class="bar-track"><div class="bar-fill" style="--w:${Math.round(c.gf/max*100)}%"></div></div><strong>${c.gf}</strong></a>`).join('') || emptyState('Sin datos de goles','No hay partidos finalizados.');
  }
  const balance = document.getElementById('club-balance-chart');
  if (balance) balance.innerHTML = clubs.slice().sort((a,b)=>b.gd-a.gd).map(c=>`<a class="balance-row" href="club.html?id=${c.id}"><div>${clubBadge(c,true)}<b>${esc(c.name)}</b></div><span><small>GF</small>${c.gf}</span><span><small>GC</small>${c.ga}</span><strong class="gd ${c.gd>0?'positive':c.gd<0?'negative':''}">${c.gd>0?'+':''}${c.gd}</strong></a>`).join('') || emptyState('Sin balance','No hay partidos finalizados.');
}

export function renderCurrentPage() {
  if (!state.loaded) return;
  const page = document.body.dataset.page || 'inicio';
  if (page === 'inicio') renderDashboard();
  if (page === 'clubes') { renderClubes(); renderClubDetail(); }
  if (page === 'jugadores') { renderJugadores(); renderPlayerDetail(); }
  if (page === 'planteles') renderPlanteles();
  if (page === 'partidos') { renderPartidos(); renderMatchDetail(); }
  if (page === 'posiciones') renderStandings();
  if (page === 'participaciones') renderParticipaciones();
  if (page === 'estadisticas') renderStats();
}
