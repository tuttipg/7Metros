import { state } from './store.js';
import { esc, initials, normalizeText, formatDateISO, localISODate, metric } from './utils.js';
import { clubBadge, icon } from './ui.js';

const CATEGORY_ORDER = ['infantiles','menores','cadetes','juveniles','junior','juniors','mayores'];

function categoryRank(value) {
  const key = normalizeText(value).replace(/[^a-z]/g, '');
  const normalized = key === 'junior' ? 'juniors' : key;
  const index = CATEGORY_ORDER.indexOf(normalized);
  return index === -1 ? 999 : index;
}

function pageName() {
  return document.body.dataset.page || 'inicio';
}

function addHeadMetadata() {
  const title = document.title || '7Metros';
  const description = document.querySelector('meta[name="description"]')?.content || 'Estadísticas y análisis del handball argentino.';
  const ensureMeta = (attr, key, value) => {
    let node = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(attr, key);
      document.head.appendChild(node);
    }
    node.content = value;
  };
  ensureMeta('property', 'og:type', 'website');
  ensureMeta('property', 'og:title', title);
  ensureMeta('property', 'og:description', description);
  ensureMeta('property', 'og:site_name', '7Metros');
  ensureMeta('name', 'twitter:card', 'summary');
  ensureMeta('name', 'twitter:title', title);
  ensureMeta('name', 'twitter:description', description);

  if (!document.head.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
  }
  if (!document.head.querySelector('link[rel="canonical"]')) {
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = `${location.origin}${location.pathname}`;
    document.head.appendChild(canonical);
  }
}

function makeNavLink(page, href, iconName, label) {
  return `<a class="nav-link ${pageName() === page ? 'active' : ''}" href="${href}" ${pageName() === page ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(iconName)}</span><span>${esc(label)}</span></a>`;
}

function enhanceNavigation() {
  const nav = document.querySelector('#sidebar .nav');
  if (!nav || nav.dataset.autonomous === '1') return;
  nav.dataset.autonomous = '1';

  const firstGroup = nav.querySelector('.nav-group-label');
  if (firstGroup && !nav.querySelector('a[href="competiciones.html"]')) {
    firstGroup.insertAdjacentHTML('afterend', makeNavLink('competiciones', 'competiciones.html', 'ball', 'Competiciones'));
  }

  const dataLabel = [...nav.querySelectorAll('.nav-group-label')].find(el => normalizeText(el.textContent).includes('datos'));
  if (dataLabel) {
    const anchor = dataLabel.nextElementSibling;
    if (!nav.querySelector('a[href="cobertura.html"]')) {
      anchor?.insertAdjacentHTML('beforebegin', makeNavLink('cobertura', 'cobertura.html', 'database', 'Cobertura'));
    }
    if (!nav.querySelector('a[href="comparar.html"]')) {
      anchor?.insertAdjacentHTML('beforebegin', makeNavLink('comparar', 'comparar.html', 'trend', 'Comparar'));
    }
  }

  const lab = [...nav.querySelectorAll('.nav-link.disabled')].find(el => normalizeText(el.textContent).includes('ia'));
  if (lab) lab.outerHTML = `<a class="nav-link ${pageName() === 'ia' ? 'active' : ''}" href="ia-lab.html"><span class="nav-icon">${icon('ball')}</span><span>IA / VIDEO</span><em>LAB</em></a>`;

  const secondaryLabel = [...nav.querySelectorAll('.nav-group-label')].find(el => normalizeText(el.textContent).includes('gestion'));
  if (!secondaryLabel && !nav.querySelector('a[href="admin.html"]')) {
    const sep = nav.querySelector('.nav-sep');
    sep?.insertAdjacentHTML('afterend', makeNavLink('admin', 'admin.html', 'lock', 'Administración'));
  }
}

function globalClubTeams(clubId) {
  return state.teams.filter(team => Number(team.club_id) === Number(clubId));
}

function globalClubMatches(clubId) {
  const ids = new Set(globalClubTeams(clubId).map(team => Number(team.id)));
  return state.matches.filter(match => ids.has(Number(match.homeTeamId)) || ids.has(Number(match.awayTeamId)));
}

function teamStats(team) {
  const id = Number(team.id);
  const matches = state.matches.filter(m => Number(m.homeTeamId) === id || Number(m.awayTeamId) === id);
  const finished = matches.filter(m => m.status === 'Finalizado');
  let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
  finished.forEach(match => {
    const home = Number(match.homeTeamId) === id;
    const own = Number(home ? match.homeScore : match.awayScore) || 0;
    const opp = Number(home ? match.awayScore : match.homeScore) || 0;
    gf += own; ga += opp;
    if (own > opp) won += 1; else if (own === opp) drawn += 1; else lost += 1;
  });
  return { matches: matches.length, finished: finished.length, won, drawn, lost, gf, ga, gd: gf - ga, points: won * 2 + drawn };
}

function globalClubCard(club) {
  const teams = globalClubTeams(club.id);
  const matches = globalClubMatches(club.id);
  const divisions = new Set(teams.map(t => `${t.rama}:${t.categoria}:${t.division}`));
  return `<a class="all-club-card" href="club.html?id=${club.id}&global=1">
    ${clubBadge(club)}
    <span><b>${esc(club.name)}</b><small>${teams.length} equipos · ${divisions.size} competencias · ${matches.length} partidos</small></span>
    <strong>Ver club →</strong>
  </a>`;
}

function enhanceHome() {
  if (pageName() !== 'inicio' || document.getElementById('all-clubs-section')) return;
  const ai = document.querySelector('.ai-teaser');
  const section = document.createElement('section');
  section.id = 'all-clubs-section';
  section.className = 'card section-card all-clubs-section';
  section.innerHTML = `
    <div class="section-head"><div><span class="section-kicker">DIRECTORIO GLOBAL</span><h2>Todos los clubes cargados</h2><p>El inicio no limita esta lista por categoría, rama ni división.</p></div><span class="coverage-badge">${metric(state.clubs.length)} clubes</span></div>
    <label class="all-clubs-search">${icon('search')}<input id="home-club-search" type="search" placeholder="Buscar club…" autocomplete="off"></label>
    <div id="home-club-grid" class="all-clubs-grid"></div>
    <div class="section-foot-actions"><a class="btn light" href="clubes.html">Explorar por competencia</a><a class="btn light" href="cobertura.html">Ver cobertura de datos</a></div>`;
  ai?.parentElement?.insertBefore(section, ai);

  const grid = section.querySelector('#home-club-grid');
  const input = section.querySelector('#home-club-search');
  const render = () => {
    const term = normalizeText(input?.value || '');
    const clubs = state.clubs.slice().sort((a,b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      .filter(c => !term || normalizeText(c.name).includes(term));
    grid.innerHTML = clubs.map(globalClubCard).join('') || '<div class="empty-state"><b>No encontramos clubes</b><p>Probá con otra búsqueda.</p></div>';
  };
  input?.addEventListener('input', render);
  render();
}

function competitionLink(team) {
  const params = new URLSearchParams({ rama: team.rama || '', categoria: team.categoria || '', division: team.division || '' });
  return `posiciones.html?${params.toString()}`;
}

function renderGlobalClubProfile() {
  if (pageName() !== 'clubes') return;
  const root = document.getElementById('club-detail');
  const params = new URLSearchParams(location.search);
  const clubId = Number(params.get('id'));
  if (!root || !Number.isFinite(clubId)) return;
  const base = state.index.clubById.get(clubId);
  if (!base) return;

  const teams = globalClubTeams(clubId).slice().sort((a,b) => categoryRank(a.categoria)-categoryRank(b.categoria) || String(a.rama).localeCompare(String(b.rama)) || String(a.division).localeCompare(String(b.division), 'es'));
  const allMatches = globalClubMatches(clubId).slice().sort((a,b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const finished = allMatches.filter(m => m.status === 'Finalizado');
  let gf = 0, ga = 0, wins = 0, draws = 0, losses = 0;
  const ids = new Set(teams.map(t => Number(t.id)));
  finished.forEach(match => {
    const home = ids.has(Number(match.homeTeamId));
    const own = Number(home ? match.homeScore : match.awayScore) || 0;
    const opp = Number(home ? match.awayScore : match.homeScore) || 0;
    gf += own; ga += opp;
    if (own > opp) wins += 1; else if (own === opp) draws += 1; else losses += 1;
  });
  const rosterRows = state.rosters.filter(r => ids.has(Number(r.equipo_id)));
  const uniquePlayers = new Set(rosterRows.map(r => Number(r.jugador_id)));

  const header = document.querySelector('.page-header h1');
  const sub = document.querySelector('.page-header p');
  if (header) header.textContent = base.name;
  if (sub) sub.textContent = `Perfil global · ${teams.length} equipos cargados en la temporada`;
  document.title = `${base.name} — 7Metros`;

  const teamRows = teams.map(team => {
    const stats = teamStats(team);
    const rama = team.rama === 'F' ? 'Femenino' : team.rama === 'M' ? 'Masculino' : team.rama;
    return `<a class="global-team-row" href="${competitionLink(team)}"><span><b>${esc(team.categoria)} · ${esc(team.division)}</b><small>${esc(rama)}${team.equipo_codigo && team.equipo_codigo !== 'A' ? ` · Equipo ${esc(team.equipo_codigo)}` : ''}</small></span><span>${stats.matches} partidos</span><span>${stats.finished ? `${stats.points} pts · ${stats.gf}:${stats.ga}` : 'Fixture cargado'}</span><strong>Explorar →</strong></a>`;
  }).join('');

  const recent = allMatches.slice(0, 8).map(match => `<a class="global-match-row" href="partido.html?id=${match.id}"><span>${formatDateISO(match.date)}</span><b>${esc(match.home)}</b><strong>${match.status === 'Finalizado' ? `${match.homeScore}–${match.awayScore}` : (match.time || 'VS')}</strong><b>${esc(match.away)}</b></a>`).join('');

  root.innerHTML = `
    <section class="card club-global-hero"><div class="club-global-title">${clubBadge(base)}<div><span class="section-kicker">PERFIL GLOBAL</span><h2>${esc(base.name)}</h2><p>${teams.length} equipos · ${allMatches.length} partidos · ${uniquePlayers.size} jugadores registrados</p></div></div><div class="global-kpis"><span><b>${teams.length}</b>Equipos</span><span><b>${allMatches.length}</b>Partidos</span><span><b>${finished.length}</b>Finalizados</span><span><b>${gf}</b>GF</span><span><b>${ga}</b>GC</span></div></section>
    <section class="club-global-grid"><article class="card section-card"><div class="section-head"><div><span class="section-kicker">COBERTURA</span><h2>Equipos y competiciones</h2></div></div><div class="global-team-list">${teamRows || '<p>Sin equipos cargados.</p>'}</div></article><article class="card section-card"><div class="section-head"><div><span class="section-kicker">CALENDARIO</span><h2>Partidos recientes</h2></div></div><div class="global-match-list">${recent || '<p>Sin partidos cargados.</p>'}</div></article></section>
    ${finished.length ? `<section class="card section-card"><div class="section-head"><div><span class="section-kicker">RENDIMIENTO TOTAL</span><h2>Balance agregado</h2></div></div><div class="global-balance"><span><b>${wins}</b>Ganados</span><span><b>${draws}</b>Empatados</span><span><b>${losses}</b>Perdidos</span><span><b>${gf-ga >= 0 ? '+' : ''}${gf-ga}</b>Diferencia</span></div></section>` : ''}`;
}

function coverageRows() {
  const grouped = new Map();
  state.teams.forEach(team => {
    const key = [team.rama, team.categoria, team.division].join('|');
    if (!grouped.has(key)) grouped.set(key, { rama: team.rama, categoria: team.categoria, division: team.division, teams: [], teamIds: new Set() });
    const row = grouped.get(key);
    row.teams.push(team);
    row.teamIds.add(Number(team.id));
  });
  return [...grouped.values()].map(row => {
    const matches = state.matches.filter(m => row.teamIds.has(Number(m.homeTeamId)) && row.teamIds.has(Number(m.awayTeamId)));
    const results = matches.filter(m => m.status === 'Finalizado').length;
    return { ...row, matches: matches.length, results };
  }).sort((a,b) => categoryRank(a.categoria)-categoryRank(b.categoria) || String(a.rama).localeCompare(String(b.rama)) || String(a.division).localeCompare(String(b.division), 'es'));
}

function renderCoveragePage() {
  if (pageName() !== 'cobertura') return;
  const root = document.getElementById('coverage-root');
  if (!root) return;
  const rows = coverageRows();
  const uniqueCategories = new Set(state.teams.map(t => normalizeText(t.categoria).replace('junior','juniors'))).size;
  const withLogo = state.clubs.filter(c => c.logoUrl).length;
  const totalMatches = state.globalSummary?.matches ?? state.matches.length;
  const finished = state.globalSummary?.finished ?? state.matches.filter(m=>m.status==='Finalizado').length;
  const goals = state.globalSummary?.goals ?? 0;
  const players = state.globalSummary?.players ?? state.players.length;
  root.innerHTML = `
    <section class="coverage-kpis"><article class="card"><small>CLUBES</small><b>${metric(state.clubs.length)}</b><span>${withLogo} con escudo</span></article><article class="card"><small>EQUIPOS</small><b>${metric(state.teams.length)}</b><span>${uniqueCategories} categorías normalizadas</span></article><article class="card"><small>PARTIDOS</small><b>${metric(totalMatches)}</b><span>${metric(finished)} con resultado</span></article><article class="card"><small>JUGADORES</small><b>${metric(players)}</b><span>perfiles deportivos cargados</span></article><article class="card"><small>GOLES</small><b>${metric(goals)}</b><span>en resultados disponibles</span></article></section>
    <section class="card section-card"><div class="section-head"><div><span class="section-kicker">MATRIZ FEMEBAL</span><h2>Cobertura por rama, categoría y división</h2></div><span class="coverage-badge">${rows.length} competiciones</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>RAMA</th><th>CATEGORÍA</th><th>DIVISIÓN</th><th>EQUIPOS</th><th>PARTIDOS</th><th>RESULTADOS</th><th>ESTADO</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.rama === 'F' ? 'Femenino' : 'Masculino'}</td><td>${esc(row.categoria === 'Junior' ? 'Juniors' : row.categoria)}</td><td>${esc(row.division)}</td><td>${row.teams.length}</td><td>${row.matches}</td><td>${row.results}</td><td><span class="status-pill ${row.results ? '' : 'gold'}">${row.results ? 'CON RESULTADOS' : 'FIXTURE'}</span></td></tr>`).join('')}</tbody></table></div></section>
    <section class="coverage-notes"><article class="card section-card"><span class="section-kicker">CALIDAD</span><h2>La cobertura distingue existencia de fixture y profundidad estadística</h2><p>7Metros no inventa estadísticas faltantes: partidos sin resultado, jugadores sin participaciones y videos sin procesar se muestran como datos pendientes. Esto evita que números simulados se mezclen con información real.</p></article><article class="card section-card"><span class="section-kicker">SIGUIENTE CAPA</span><h2>De fixture a analítica avanzada</h2><p>La base ya contempla participaciones, lanzamientos, acciones defensivas, videos y eventos de IA. A medida que esas fuentes se carguen, las páginas de jugador, rankings y mapas de tiro se completarán automáticamente.</p></article></section>`;
}

function selectOptions(items, valueFn, labelFn) {
  return items.map(item => `<option value="${esc(valueFn(item))}">${esc(labelFn(item))}</option>`).join('');
}

function renderComparePage() {
  if (pageName() !== 'comparar') return;
  const root = document.getElementById('compare-root');
  if (!root) return;
  const teams = state.teams.slice().sort((a,b) => String(a.nombre_femebal).localeCompare(String(b.nombre_femebal),'es') || categoryRank(a.categoria)-categoryRank(b.categoria));
  const clubName = team => state.index.clubById.get(Number(team.club_id))?.name || team.nombre_femebal || 'Equipo';
  const teamLabel = team => `${clubName(team)} · ${team.categoria === 'Junior' ? 'Juniors' : team.categoria} · ${team.division} · ${team.rama}${team.equipo_codigo !== 'A' ? ` · ${team.equipo_codigo}` : ''}`;
  const teamOptions = selectOptions(teams, t => String(t.id), teamLabel);
  root.innerHTML = `<section class="card section-card compare-controls"><div class="section-head"><div><span class="section-kicker">COMPARADOR</span><h2>Equipo contra equipo</h2><p>Comparación construida con los datos reales disponibles en la temporada.</p></div></div><div class="compare-selects"><label>Equipo A<select id="compare-a">${teamOptions}</select></label><span>VS</span><label>Equipo B<select id="compare-b">${teamOptions}</select></label></div></section><section id="compare-result"></section><section class="card section-card"><span class="section-kicker">JUGADORES</span><h2>Comparación individual</h2><p>${state.players.length ? 'Seleccioná jugadores desde sus perfiles para contrastar rendimiento.' : 'La estructura está lista, pero todavía no hay jugadores cargados en Supabase. El comparador individual se habilita automáticamente al ingresar planteles y participaciones.'}</p></section>`;
  const a = root.querySelector('#compare-a');
  const b = root.querySelector('#compare-b');
  if (teams.length > 1) b.selectedIndex = 1;
  const result = root.querySelector('#compare-result');
  const draw = () => {
    const ta = state.index.teamById.get(Number(a.value));
    const tb = state.index.teamById.get(Number(b.value));
    if (!ta || !tb) { result.innerHTML = ''; return; }
    const sa = teamStats(ta), sb = teamStats(tb);
    const card = (team, stats) => `<article class="card compare-team"><span class="section-kicker">${team.rama === 'F' ? 'FEMENINO' : 'MASCULINO'} · ${esc(team.categoria)}</span><h2>${esc(clubName(team))}</h2><p>${esc(team.division)}${team.equipo_codigo !== 'A' ? ` · Equipo ${esc(team.equipo_codigo)}` : ''}</p><div class="compare-stats"><span><b>${stats.matches}</b>Partidos</span><span><b>${stats.finished}</b>Finalizados</span><span><b>${stats.won}</b>PG</span><span><b>${stats.drawn}</b>PE</span><span><b>${stats.lost}</b>PP</span><span><b>${stats.gf}</b>GF</span><span><b>${stats.ga}</b>GC</span><span><b>${stats.gd >= 0 ? '+' : ''}${stats.gd}</b>DIF</span><span><b>${stats.points}</b>PTS</span></div></article>`;
    result.innerHTML = `<div class="compare-grid">${card(ta,sa)}${card(tb,sb)}</div>`;
  };
  a.addEventListener('change', draw); b.addEventListener('change', draw); draw();
}

function renderAiLabPage() {
  if (pageName() !== 'ia') return;
  const root = document.getElementById('ai-lab-root');
  if (!root) return;
  root.innerHTML = `
    <section class="ai-lab-hero card"><div><span class="section-kicker">7METROS LAB · ARQUITECTURA V1</span><h2>Video → detección → tracking → eventos → estadísticas</h2><p>La plataforma queda preparada para recibir análisis automático sin mezclar predicciones crudas con estadísticas validadas.</p></div><span class="status-pill gold">PIPELINE PREPARADO</span></section>
    <section class="pipeline-grid">${[['1','INGESTA','Video completo, metadatos, partido y fuente.'],['2','DETECCIÓN','Jugadores, pelota, arcos y geometría de cancha.'],['3','TRACKING','Identidades temporales robustas con oclusiones y reentrada.'],['4','IDENTIDAD','Equipo, dorsal y correspondencia con plantel.'],['5','EVENTOS','Lanzamientos, goles, pérdidas, recuperaciones y sanciones.'],['6','REVISIÓN','Confianza, timestamps y corrección humana antes de publicar.']].map(([n,t,p])=>`<article class="card pipeline-card"><span>${n}</span><b>${t}</b><p>${p}</p></article>`).join('')}</section>
    <section class="ai-readiness-grid"><article class="card section-card"><span class="section-kicker">BASE DE DATOS</span><h2>Modelo listo para eventos de IA</h2><p>Jobs de procesamiento, eventos por timestamp, confianza, track ID, bounding boxes y estado de revisión quedan separados de las estadísticas oficiales.</p></article><article class="card section-card"><span class="section-kicker">CONTROL DE CALIDAD</span><h2>Predicción ≠ dato validado</h2><p>Solo los eventos revisados deben alimentar vistas públicas. Este diseño permite mejorar modelos sin degradar la confianza del producto.</p></article><article class="card section-card"><span class="section-kicker">OBJETIVO</span><h2>Analítica específica de handball</h2><p>El roadmap prioriza detección de pelota y dorsal, zonas de lanzamiento, contexto ataque/defensa, alineaciones y clips automáticos por evento.</p></article></section>
    <section class="card section-card"><div class="section-head"><div><span class="section-kicker">ESTADO ACTUAL</span><h2>Datos disponibles para entrenar y evaluar</h2></div></div><div class="coverage-kpis"><article><small>VIDEOS CARGADOS</small><b>0</b></article><article><small>EVENTOS REVISADOS</small><b>0</b></article><article><small>JUGADORES IDENTIFICADOS</small><b>${metric(state.players.length)}</b></article><article><small>PARTIDOS EN BASE</small><b>${metric(state.globalSummary?.matches ?? state.matches.length)}</b></article></div><p class="muted-note">La ausencia de videos etiquetados impide afirmar precisión de detección o tracking. El pipeline y los contratos de datos sí pueden dejarse listos; el entrenamiento real requiere material audiovisual y anotaciones.</p></section>`;
}

export function enhanceAutonomousFeatures() {
  addHeadMetadata();
  enhanceNavigation();
  if (!state.loaded) return;
  enhanceHome();
  renderGlobalClubProfile();
  renderCoveragePage();
  renderComparePage();
  renderAiLabPage();
}
