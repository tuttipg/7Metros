import { CONFIG, SEASON_LABEL, STORAGE_KEYS } from './config.js';
import {
  state, getCompetitionOptions, setFilters, getPlayers, getClubs, getMatches,
  getStandings, clearStoredFilters, selectedCompetitionLabel
} from './store.js';
import { esc, initials, currentDateLabel, csvDownload, metric, normalizeText, safeHttpUrl } from './utils.js';

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  shield: '<path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-5"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
  chart: '<path d="M4 20V10M9 20V4M14 20v-7M19 20V7M2 20h20"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7 3 2-1 4h-4L9 9l3-2ZM6 11l4 2M18 11l-4 2M9 18l1-5M15 18l-1-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.6.7 1 .9.2.1.6.1.9.1H21v4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  goal: '<rect x="3" y="7" width="18" height="11" rx="1"/><path d="M3 11h18M7 7v11M12 7v11M17 7v11"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  standings: '<path d="M4 4h16M4 10h16M4 16h16M4 22h16"/><path d="M7 2v4M12 8v4M17 14v4"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  external: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.8-2L20 11M4 13l2.1 4a7 7 0 0 0 11.8-2"/>'
};

export function icon(name, cls = '') {
  const content = ICONS[name] || ICONS.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

export function clubBadge(club, small = false) {
  const id = Number(club?.id) || 0;
  const cls = small ? 'mini-badge' : 'club-badge';
  const fallback = esc(club?.abbr || initials(club?.name || '7M'));
  const logoUrl = safeHttpUrl(club?.logoUrl || club?.logo_url || '');

  if (!logoUrl) {
    return `<span class="${cls}" data-club-tone="${id % 6}">${fallback}</span>`;
  }

  return `<span class="${cls}" data-club-tone="${id % 6}"><span style="grid-area:1/1">${fallback}</span><img src="${esc(logoUrl)}" alt="" loading="lazy" decoding="async" style="grid-area:1/1;width:82%;height:82%;object-fit:contain;background:#fff;border-radius:16%" onerror="this.remove()"></span>`;
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

export function renderShell() {
  const page = document.body.dataset.page || 'inicio';
  const primary = [
    ['inicio', 'index.html', 'home', 'Inicio'],
    ['competiciones', 'competiciones.html', 'ball', 'Competiciones'],
    ['posiciones', 'posiciones.html', 'standings', 'Posiciones'],
    ['partidos', 'partidos.html', 'calendar', 'Partidos'],
    ['clubes', 'clubes.html', 'shield', 'Clubes'],
    ['jugadores', 'jugadores.html', 'user', 'Jugadores'],
    ['planteles', 'planteles.html', 'users', 'Planteles'],
    ['estadisticas', 'estadisticas.html', 'chart', 'Estadísticas']
  ];
  const data = [
    ['participaciones', 'participaciones.html', 'clipboard', 'Participaciones'],
    ['reportes', 'reportes.html', 'download', 'Reportes']
  ];
  const secondary = [
    ['ajustes', 'ajustes.html', 'settings', 'Ajustes'],
    ['acerca', 'acerca-de.html', 'info', 'Acerca de']
  ];

  const links = list => list.map(([id, href, iconName, label]) =>
    `<a class="nav-link ${page === id ? 'active' : ''}" href="${href}" ${page === id ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(iconName)}</span><span>${label}</span></a>`
  ).join('');

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand"><a href="index.html" aria-label="7Metros - Inicio"><div class="brand-logo"><span class="seven">7</span><span class="m">M</span></div><span class="brand-name">7<b>METROS</b></span><span class="brand-sub">HANDBALL APP</span></a></div>
      <button class="nav-search" id="global-search-open" type="button"><span class="nav-icon">${icon('search')}</span><span>Buscar</span><kbd>Ctrl K</kbd></button>
      <nav class="nav"><span class="nav-group-label">COMPETICIÓN</span>${links(primary)}<span class="nav-group-label">DATOS</span>${links(data)}<button class="nav-link disabled" type="button" title="Análisis de video e IA en desarrollo"><span class="nav-icon">${icon('ball')}</span><span>IA / VIDEO</span><em>LAB</em></button><div class="nav-sep"></div>${links(secondary)}</nav>
      <div class="sidebar-foot"><span class="live-dot"></span><span>Datos conectados</span></div>`;
  }

  const mobile = document.getElementById('mobile-bar');
  if (mobile) {
    mobile.innerHTML = `<a class="mobile-brand" href="index.html">7<b>METROS</b></a><div class="mobile-actions"><button id="mobile-search" class="icon-btn" aria-label="Buscar">${icon('search')}</button><button id="menu-open" class="icon-btn" aria-label="Abrir menú" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button></div>`;
  }

  document.querySelectorAll('[data-current-date]').forEach(el => el.textContent = currentDateLabel());
  document.querySelectorAll('[data-season-label]').forEach(el => el.textContent = SEASON_LABEL);
  document.querySelectorAll('[data-femebal-link]').forEach(el => { el.href = CONFIG.links?.femebal || 'https://femebal.com/'; });
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

  const overlay = document.getElementById('overlay');
  const menuOpen = document.getElementById('menu-open');
  const setMenuState = open => {
    sidebar?.classList.toggle('open', open);
    overlay?.classList.toggle('show', open);
    menuOpen?.setAttribute('aria-expanded', String(open));
    menuOpen?.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  const openMenu = () => setMenuState(true);
  const closeMenu = ({ returnFocus = false } = {}) => {
    setMenuState(false);
    if (returnFocus) menuOpen?.focus();
  };
  menuOpen?.addEventListener('click', openMenu);
  overlay?.addEventListener('click', () => closeMenu({ returnFocus: true }));
  sidebar?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar?.classList.contains('open')) {
      event.preventDefault();
      closeMenu({ returnFocus: true });
    }
  });

  applySettings();
  initGlobalSearch();
}

export function renderLoadingStatus() {
  const root = document.getElementById('data-status');
  if (!root) return;
  root.innerHTML = `<div class="status-banner loading"><span class="spinner"></span><div><b>Cargando datos</b><small>Conectando con la base de 7Metros…</small></div></div>`;
}

export function renderSuccessStatus() {
  const root = document.getElementById('data-status');
  if (!root) return;
  root.innerHTML = '';
  document.querySelectorAll('.loading-block').forEach(el => el.classList.remove('loading-block'));
}

export function renderErrorStatus(error) {
  const root = document.getElementById('data-status');
  if (!root) return;
  root.innerHTML = `<div class="status-banner error"><span>${icon('info')}</span><div><b>No pudimos cargar los datos</b><small>${esc(error?.message || 'Revisá la conexión e intentá nuevamente.')}</small></div><button class="btn light" id="retry-data">${icon('refresh')}Reintentar</button></div>`;
  document.getElementById('retry-data')?.addEventListener('click', () => location.reload());
}

function categoryLabel(value) {
  const key = normalizeText(value).replace(/[^a-z]/g, '');
  const labels = {
    infantil: 'Infantiles', infantiles: 'Infantiles',
    menor: 'Menores', menores: 'Menores',
    cadete: 'Cadetes', cadetes: 'Cadetes',
    juvenil: 'Juveniles', juveniles: 'Juveniles',
    junior: 'Juniors', juniors: 'Juniors',
    mayor: 'Mayores', mayores: 'Mayores'
  };
  return labels[key] || value;
}

function branchLabel(value) {
  if (value === 'M') return 'Masculino';
  if (value === 'F') return 'Femenino';
  return value || 'Rama';
}

export function renderCompetitionBar() {
  const root = document.getElementById('competition-bar');
  if (document.body.dataset.page === 'inicio') {
    if (root) root.remove();
    return;
  }
  if (!root || !state.loaded) return;
  const { categorias, divisiones, ramas, resolved } = getCompetitionOptions();

  const options = (values, selected, prefix, mapper = v => v) => values.map(value =>
    `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${prefix}: ${esc(mapper(value))}</option>`
  ).join('');

  root.innerHTML = `
    <div class="competition-context"><span class="context-icon">${icon('ball')}</span><div><small>Viendo</small><b>${esc(selectedCompetitionLabel())}</b></div></div>
    <div class="competition-selects">
      <select id="branch-select" class="competition-select" aria-label="Rama">${options(ramas, resolved.rama, 'Rama', branchLabel)}</select>
      <select id="category-select" class="competition-select" aria-label="Categoría">${options(categorias, resolved.categoria, 'Categoría', categoryLabel)}</select>
      <select id="division-select" class="competition-select" aria-label="División">${options(divisiones, resolved.division, 'División')}</select>
    </div>`;

  const emit = () => document.dispatchEvent(new CustomEvent('7m:filters-changed'));
  document.getElementById('branch-select')?.addEventListener('change', event => {
    setFilters({ rama: event.target.value, categoria: '', division: '' });
    renderCompetitionBar(); emit();
  });
  document.getElementById('category-select')?.addEventListener('change', event => {
    setFilters({ categoria: event.target.value, division: '' });
    renderCompetitionBar(); emit();
  });
  document.getElementById('division-select')?.addEventListener('change', event => {
    setFilters({ division: event.target.value });
    renderCompetitionBar(); emit();
  });

  document.querySelectorAll('[data-competition-label]').forEach(el => el.textContent = selectedCompetitionLabel().toUpperCase());
  const hero = document.querySelector('[data-hero-competition]');
  if (hero) hero.textContent = `${SEASON_LABEL} · ${branchLabel(state.filters.rama)}`;
}

function initGlobalSearch() {
  const root = document.getElementById('global-search-root');
  if (!root) return;
  root.innerHTML = `<div class="search-modal" id="global-search-modal" aria-hidden="true"><div class="search-dialog" role="dialog" aria-modal="true" aria-label="Buscar en 7Metros"><div class="search-dialog-head"><span>${icon('search')}</span><input id="global-search-input" type="search" placeholder="Buscar jugador o club…" autocomplete="off"><button id="global-search-close" class="icon-btn" aria-label="Cerrar">${icon('close')}</button></div><div id="global-search-results" class="search-results"><div class="search-hint">Escribí un nombre para buscar en la competencia seleccionada.</div></div><div class="search-dialog-foot"><span>Enter para abrir</span><span>Esc para cerrar</span></div></div></div>`;

  const modal = document.getElementById('global-search-modal');
  const input = document.getElementById('global-search-input');
  const results = document.getElementById('global-search-results');

  const open = () => {
    if (!state.loaded) { showToast('Esperá a que terminen de cargar los datos.'); return; }
    modal?.classList.add('show');
    modal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => input?.focus(), 30);
  };
  const close = () => {
    modal?.classList.remove('show');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (input) input.value = '';
    if (results) results.innerHTML = '<div class="search-hint">Escribí un nombre para buscar en la competencia seleccionada.</div>';
  };

  document.getElementById('global-search-open')?.addEventListener('click', open);
  document.getElementById('mobile-search')?.addEventListener('click', open);
  document.getElementById('global-search-close')?.addEventListener('click', close);
  modal?.addEventListener('click', event => { if (event.target === modal) close(); });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
    if (event.key === 'Escape' && modal?.classList.contains('show')) close();
  });

  input?.addEventListener('input', () => {
    const term = normalizeText(input.value);
    if (!term) { results.innerHTML = '<div class="search-hint">Escribí un nombre para buscar en la competencia seleccionada.</div>'; return; }
    const clubs = getClubs().filter(c => normalizeText(c.name).includes(term)).slice(0, 5);
    const players = getPlayers().filter(p => normalizeText(`${p.name} ${p.club}`).includes(term)).slice(0, 7);
    const rows = [
      ...clubs.map(c => `<a class="search-result" href="club.html?id=${c.id}">${clubBadge(c, true)}<span><b>${esc(c.name)}</b><small>Club · ${c.points} pts</small></span></a>`),
      ...players.map(p => `<a class="search-result" href="jugador.html?id=${p.id}"><span class="avatar">${esc(initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.club)} · ${p.goals} goles</small></span></a>`)
    ];
    results.innerHTML = rows.join('') || '<div class="search-hint">No encontramos coincidencias.</div>';
  });
}

export function applySettings() {
  const compact = localStorage.getItem(STORAGE_KEYS.compact) === '1';
  const motion = localStorage.getItem(STORAGE_KEYS.motion) === '1';
  document.body.classList.toggle('compact-tables', compact);
  document.body.classList.toggle('reduce-motion', motion);
}

export function initSettingsPage() {
  const map = {
    filters: { key: STORAGE_KEYS.rememberFilters, default: true },
    compact: { key: STORAGE_KEYS.compact, default: false },
    motion: { key: STORAGE_KEYS.motion, default: false }
  };

  document.querySelectorAll('[data-setting]').forEach(input => {
    const item = map[input.dataset.setting];
    if (!item) return;
    const stored = localStorage.getItem(item.key);
    input.checked = stored === null ? item.default : stored === '1';
    input.addEventListener('change', () => {
      localStorage.setItem(item.key, input.checked ? '1' : '0');
      if (input.dataset.setting === 'filters' && !input.checked) clearStoredFilters();
      applySettings();
      showToast('Preferencia guardada.');
    });
  });

  document.getElementById('reset-settings')?.addEventListener('click', () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    showToast('Preferencias restablecidas.');
    setTimeout(() => location.reload(), 350);
  });
}

export function initReports() {
  document.querySelectorAll('[data-report]').forEach(button => {
    button.addEventListener('click', () => {
      const type = button.dataset.report;
      if (!state.loaded) return showToast('Los datos todavía se están cargando.');
      const suffix = `${state.filters.categoria}_${state.filters.division}_${state.filters.rama}`.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      let rows = [];
      let name = '';

      if (type === 'jugadores') {
        rows = [['Jugador', 'Club', 'Dorsal', 'Posición', 'Partidos', 'Goles', 'Goles/Partido', '2min', 'Amarillas', 'Rojas'], ...getPlayers().map(p => [p.name, p.club, p.number, p.position, p.matchesPlayed, p.goals, p.goalsPerMatch ?? '', p.twoMin, p.yellow, p.red])];
        name = `7metros_jugadores_${suffix}.csv`;
      } else if (type === 'partidos') {
        rows = [['Fecha', 'Hora', 'Jornada', 'Local', 'Visitante', 'Estado', 'Goles local', 'Goles visitante'], ...getMatches().map(m => [m.date, m.time, m.roundLabel, m.home, m.away, m.status, m.homeScore ?? '', m.awayScore ?? ''])];
        name = `7metros_partidos_${suffix}.csv`;
      } else if (type === 'posiciones') {
        rows = [['Posición', 'Club', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DIF', 'PTS'], ...getStandings().map((c, i) => [i + 1, c.name, c.played, c.won, c.drawn, c.lost, c.gf, c.ga, c.gd, c.points])];
        name = `7metros_posiciones_${suffix}.csv`;
      } else {
        rows = [['Jugador', 'Club', 'Partidos', 'Goles', 'Goles/Partido', 'Sanciones'], ...getPlayers().map(p => [p.name, p.club, p.matchesPlayed, p.goals, p.goalsPerMatch ?? '', p.sanctions])];
        name = `7metros_estadisticas_${suffix}.csv`;
      }
      csvDownload(rows, name);
      showToast('Reporte CSV generado.');
    });
  });
}

export function dataFreshnessLabel() {
  if (!state.loadedAt) return 'Sin actualizar';
  return `Actualizado ${state.loadedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}
