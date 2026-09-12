/*
 * 7Metros V3 — bootstrap robusto.
 *
 * Objetivos:
 * 1) No depender de una carpeta /js: todos los módulos viven en la raíz.
 * 2) Renderizar marca, navegación e iconos ANTES de cargar datos.
 * 3) Si falla un módulo o Supabase, la web sigue siendo navegable y explica el problema.
 * 4) Cargar las capas visuales globales sin duplicar enlaces CSS en cada HTML.
 * 5) Permitir enlaces profundos a una competencia con rama/categoría/división en la URL.
 */

window.SEVEN_METROS_CONFIG = Object.freeze({
  supabaseUrl: 'https://bvnfgfwxnkusicipwlas.supabase.co',
  supabaseKey: 'sb_publishable_xjIsk7dLam6gOKSG1FbwOQ_tResnm7U',
  seasonId: 3,
  seasonLabel: 'CLAUSURA 2026',
  timezone: 'America/Argentina/Buenos_Aires',
  locale: 'es-AR',
  defaults: Object.freeze({
    categoria: 'Mayores',
    division: 'LHC Hipotecario Seguros',
    rama: 'M'
  }),
  links: Object.freeze({
    femebal: 'https://femebal.com/',
    github: 'https://github.com/tuttipg/7Metros'
  }),
  app: Object.freeze({
    name: '7Metros',
    tagline: 'Estadísticas · Análisis · Rendimiento',
    readOnlyPublic: true,
    dataSourceLabel: 'Datos de competencia cargados desde fuentes Fe.Me.Bal.'
  })
});

function loadStylesheet(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

loadStylesheet('seven-metros-v3-theme', 'v3.css');
loadStylesheet('seven-metros-identity-theme', 'identity.css');
loadStylesheet('seven-metros-features-theme', 'features.css');

const BOOT_ICONS = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  shield:'<path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-5"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
  chart:'<path d="M4 20V10M9 20V4M14 20v-7M19 20V7M2 20h20"/>',
  ball:'<circle cx="12" cy="12" r="9"/><path d="m12 7 3 2-1 4h-4L9 9l3-2ZM6 11l4 2M18 11l-4 2M9 18l1-5M15 18l-1-5"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.6.7 1 .9.2.1.6.1.9.1H21v4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  standings:'<path d="M4 4h16M4 10h16M4 16h16M4 22h16"/><path d="M7 2v4M12 8v4M17 14v4"/>',
  goal:'<rect x="3" y="7" width="18" height="11" rx="1"/><path d="M3 11h18M7 7v11M12 7v11M17 7v11"/>',
  trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'
};

function bootIcon(name) {
  const body = BOOT_ICONS[name] || BOOT_ICONS.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function renderBootstrapShell() {
  const page = document.body.dataset.page || 'inicio';
  const groups = {
    primary: [
      ['inicio','index.html','home','Inicio'],
      ['competiciones','competiciones.html','ball','Competiciones'],
      ['posiciones','posiciones.html','standings','Posiciones'],
      ['partidos','partidos.html','calendar','Partidos'],
      ['clubes','clubes.html','shield','Clubes'],
      ['jugadores','jugadores.html','user','Jugadores'],
      ['planteles','planteles.html','users','Planteles'],
      ['estadisticas','estadisticas.html','chart','Estadísticas']
    ],
    data: [
      ['participaciones','participaciones.html','clipboard','Participaciones'],
      ['reportes','reportes.html','download','Reportes']
    ],
    secondary: [
      ['ajustes','ajustes.html','settings','Ajustes'],
      ['acerca','acerca-de.html','info','Acerca de']
    ]
  };

  const links = list => list.map(([id, href, ic, label]) =>
    `<a class="nav-link ${page === id ? 'active' : ''}" href="${href}" ${page === id ? 'aria-current="page"' : ''}><span class="nav-icon">${bootIcon(ic)}</span><span>${label}</span></a>`
  ).join('');

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand"><a href="index.html" aria-label="7Metros - Inicio"><div class="brand-logo"><span class="seven">7</span><span class="m">M</span></div><span class="brand-name">7<b>METROS</b></span><span class="brand-sub">HANDBALL APP</span></a></div>
      <a class="nav-search" href="jugadores.html"><span class="nav-icon">${bootIcon('search')}</span><span>Buscar</span><kbd>Ctrl K</kbd></a>
      <nav class="nav"><span class="nav-group-label">COMPETICIÓN</span>${links(groups.primary)}<span class="nav-group-label">DATOS</span>${links(groups.data)}<div class="nav-link disabled"><span class="nav-icon">${bootIcon('ball')}</span><span>IA / VIDEO</span><em>LAB</em></div><div class="nav-sep"></div>${links(groups.secondary)}</nav>
      <div class="sidebar-foot"><span class="live-dot"></span><span>7Metros conectado</span></div>`;
  }

  const mobile = document.getElementById('mobile-bar');
  if (mobile) {
    mobile.innerHTML = `<a class="mobile-brand" href="index.html">7<b>METROS</b></a><div class="mobile-actions"><a class="icon-btn" href="jugadores.html" aria-label="Buscar">${bootIcon('search')}</a><button id="menu-open" class="icon-btn" aria-label="Abrir menú">${bootIcon('menu')}</button></div>`;
  }

  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = bootIcon(el.dataset.icon); });
  document.querySelectorAll('[data-season-label]').forEach(el => { el.textContent = window.SEVEN_METROS_CONFIG.seasonLabel; });
  document.querySelectorAll('[data-femebal-link]').forEach(el => { el.href = window.SEVEN_METROS_CONFIG.links.femebal; });
  document.querySelectorAll('[data-current-date]').forEach(el => {
    try {
      el.textContent = new Intl.DateTimeFormat('es-AR', { day:'2-digit', month:'long', year:'numeric', timeZone:'America/Argentina/Buenos_Aires' }).format(new Date());
    } catch {
      el.textContent = new Date().toLocaleDateString('es-AR');
    }
  });

  const overlay = document.getElementById('overlay');
  document.getElementById('menu-open')?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('show');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
  });
}

function showBootstrapError(error) {
  console.error('7Metros: no se pudo iniciar la aplicación', error);
  const root = document.getElementById('data-status');
  const health = document.getElementById('data-health-label');
  const meta = document.getElementById('data-health-meta');
  if (health) health.textContent = 'Navegación disponible';
  if (meta) meta.textContent = 'No se pudieron iniciar los datos; el menú sigue funcionando.';
  if (root) {
    root.innerHTML = `<div class="status-banner error"><span>${bootIcon('info')}</span><div><b>No se pudieron cargar los datos</b><small>La navegación quedó activa. Revisá la consola o los archivos JavaScript del sitio.</small></div></div>`;
  }
}

function filtersFromUrl() {
  const params = new URLSearchParams(location.search);
  const next = {};
  if (params.get('rama')) next.rama = params.get('rama');
  if (params.get('categoria')) next.categoria = params.get('categoria');
  if (params.get('division')) next.division = params.get('division');
  return next;
}

renderBootstrapShell();
autoStart();

async function autoStart() {
  try {
    const store = await import('./store.js');
    const ui = await import('./ui.js');
    const pages = await import('./pages.js');
    const features = await import('./features.js');
    const freshness = await import('./match-freshness.js');

    ui.renderShell();
    ui.initSettingsPage();
    ui.initReports();
    ui.renderLoadingStatus();
    document.body.setAttribute('aria-busy', 'true');

    try {
      await store.loadData();
      const urlFilters = filtersFromUrl();
      if (Object.keys(urlFilters).length) store.setFilters(urlFilters);
      ui.renderCompetitionBar();
      pages.renderCurrentPage();
      features.enhanceCurrentPage();
      freshness.enhanceMatchFreshness();
      ui.renderSuccessStatus();
    } catch (error) {
      console.error('7Metros: error cargando datos', error);
      ui.renderErrorStatus(error);
    } finally {
      document.body.removeAttribute('aria-busy');
    }

    document.addEventListener('7m:filters-changed', () => {
      if (!store.state.loaded) return;
      pages.renderCurrentPage();
      features.enhanceCurrentPage();
      freshness.enhanceMatchFreshness();
      ui.showToast('Filtros actualizados.');
    });
  } catch (error) {
    showBootstrapError(error);
  }
}
