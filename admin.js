const cfg = window.SEVEN_METROS_CONFIG || {};
const BASE = String(cfg.supabaseUrl || '').replace(/\/$/, '');
const KEY = cfg.supabaseKey || '';
const SESSION_KEY = '7m_admin_session';

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function session() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function saveSession(data) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }
function headers(token, extra = {}) { return { apikey: KEY, Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', ...extra }; }

async function auth(email, password) {
  const response = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method:'POST', headers:{ apikey:KEY, 'Content-Type':'application/json' }, body:JSON.stringify({ email, password }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.msg || data?.error_description || 'No se pudo iniciar sesión.');
  return data;
}

async function api(path, options = {}) {
  const current = session();
  if (!current?.access_token) throw new Error('Sesión no disponible.');
  const response = await fetch(`${BASE}/rest/v1/${path}`, { ...options, headers: headers(current.access_token, options.headers || {}) });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!response.ok) throw new Error(typeof data === 'string' ? data : data?.message || data?.hint || `Error ${response.status}`);
  return data;
}

async function verifyRole(userId) {
  const rows = await api(`perfiles?id=eq.${encodeURIComponent(userId)}&select=id,nombre,apellido,rol,activo`);
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile?.activo || !['admin','colaborador','analista'].includes(profile.rol)) throw new Error('Tu usuario no tiene permisos de gestión en 7Metros.');
  return profile;
}

function renderLoggedOut(root, message = '') {
  root.innerHTML = `<section class="card admin-login"><span class="section-kicker">ACCESO RESTRINGIDO</span><h2>Administración 7Metros</h2><p>Usá una cuenta autorizada de Supabase Auth. Las operaciones siguen protegidas por RLS; esta página nunca utiliza una service key.</p>${message ? `<div class="admin-error">${esc(message)}</div>` : ''}<form id="admin-login-form"><label>Email<input name="email" type="email" required autocomplete="username"></label><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><button class="btn gold" type="submit">Ingresar</button></form></section>`;
  root.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button');
    button.disabled = true; button.textContent = 'Verificando…';
    try {
      const data = await auth(form.get('email'), form.get('password'));
      saveSession({ access_token:data.access_token, refresh_token:data.refresh_token, expires_at:Date.now()+Number(data.expires_in||3600)*1000, user:data.user });
      const profile = await verifyRole(data.user.id);
      await renderDashboard(root, profile);
    } catch (error) { clearSession(); renderLoggedOut(root, error.message); }
  });
}

async function loadAdminData() {
  const [quality, reviews, jobs] = await Promise.all([
    api('v_data_quality_summary?select=*'),
    api('import_revision?select=id,tipo,estado,fuente_url,created_at&order=created_at.desc&limit=20'),
    api('ai_jobs?select=id,partido_id,estado,modelo,modelo_version,progreso,created_at&order=created_at.desc&limit=20')
  ]);
  return { quality: quality?.[0] || {}, reviews: reviews || [], jobs: jobs || [] };
}

function qualityCards(q) {
  const items = [
    ['Clubes sin escudo',q.clubes_sin_logo],['Clubes sin abreviatura',q.clubes_sin_abreviatura],['Clubes sin ciudad',q.clubes_sin_ciudad],['Jugadores sin plantel',q.jugadores_sin_plantel],['Partidos sin resultado',q.partidos_sin_resultado],['Partidos sin planilla',q.partidos_sin_planilla],['Partidos sin fuente',q.partidos_sin_fuente_programacion],['Revisiones pendientes',q.revisiones_importacion_pendientes]
  ];
  return items.map(([label,value]) => `<article><small>${esc(label)}</small><b>${Number(value||0).toLocaleString('es-AR')}</b></article>`).join('');
}

async function runMutation(form, output) {
  const data = new FormData(form);
  const resource = data.get('resource');
  const action = data.get('action');
  const id = String(data.get('id') || '').trim();
  let payload = {};
  try { payload = JSON.parse(String(data.get('payload') || '{}')); } catch { throw new Error('El payload no es JSON válido.'); }
  const allowed = new Set(['clubes','jugadores','equipos','partidos','planteles','participaciones','videos_partidos','club_aliases','jugador_aliases']);
  if (!allowed.has(resource)) throw new Error('Recurso no permitido desde el panel.');
  let path = resource;
  let options = {};
  if (action === 'insert') options = { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(payload) };
  else {
    if (!/^\d+$/.test(id)) throw new Error('Para actualizar o eliminar necesitás un ID numérico.');
    path += `?id=eq.${id}`;
    options = action === 'update' ? { method:'PATCH', headers:{ Prefer:'return=representation' }, body:JSON.stringify(payload) } : { method:'DELETE', headers:{ Prefer:'return=representation' } };
  }
  const result = await api(path, options);
  output.textContent = JSON.stringify(result, null, 2) || 'Operación completada.';
}

async function renderDashboard(root, profile) {
  const data = await loadAdminData();
  root.innerHTML = `<section class="admin-top card"><div><span class="section-kicker">SESIÓN AUTORIZADA</span><h2>${esc([profile.nombre,profile.apellido].filter(Boolean).join(' ') || 'Usuario')} · ${esc(profile.rol)}</h2><p>Las escrituras pasan por las políticas RLS de Supabase.</p></div><button id="admin-logout" class="btn light">Cerrar sesión</button></section><section class="card section-card"><div class="section-head"><div><span class="section-kicker">CALIDAD DE DATOS</span><h2>Problemas detectables automáticamente</h2></div></div><div class="admin-quality">${qualityCards(data.quality)}</div></section><section class="admin-two"><article class="card section-card"><div class="section-head"><div><span class="section-kicker">IMPORTADOR</span><h2>Cola de revisión</h2></div></div><div class="admin-list">${data.reviews.map(r=>`<div><span><b>#${r.id} · ${esc(r.tipo)}</b><small>${esc(r.estado)} · ${esc(r.created_at||'')}</small></span></div>`).join('') || '<p>Sin revisiones pendientes.</p>'}</div></article><article class="card section-card"><div class="section-head"><div><span class="section-kicker">IA / VIDEO</span><h2>Jobs recientes</h2></div></div><div class="admin-list">${data.jobs.map(j=>`<div><span><b>#${j.id} · ${esc(j.estado)}</b><small>${esc(j.modelo||'sin modelo')} · ${Number(j.progreso||0)}%</small></span></div>`).join('') || '<p>Sin jobs de IA.</p>'}</div></article></section><section class="card section-card"><div class="section-head"><div><span class="section-kicker">EDITOR AVANZADO</span><h2>Operaciones controladas</h2><p>Herramienta para mantenimiento. Usá IDs y campos existentes; la base rechazará operaciones incompatibles.</p></div></div><form id="admin-mutation" class="admin-mutation"><label>Recurso<select name="resource">${['clubes','jugadores','equipos','partidos','planteles','participaciones','videos_partidos','club_aliases','jugador_aliases'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Acción<select name="action"><option value="insert">Insertar</option><option value="update">Actualizar</option><option value="delete">Eliminar</option></select></label><label>ID (update/delete)<input name="id" inputmode="numeric" placeholder="123"></label><label class="admin-json">Payload JSON<textarea name="payload" rows="9" spellcheck="false">{}</textarea></label><button class="btn gold" type="submit">Ejecutar</button></form><pre id="admin-output" class="admin-output" aria-live="polite">Sin operaciones en esta sesión.</pre></section>`;
  root.querySelector('#admin-logout').addEventListener('click', () => { clearSession(); renderLoggedOut(root); });
  const mutation = root.querySelector('#admin-mutation');
  mutation.addEventListener('submit', async event => {
    event.preventDefault();
    const output = root.querySelector('#admin-output');
    output.textContent = 'Ejecutando…';
    try { await runMutation(event.currentTarget, output); } catch (error) { output.textContent = `ERROR: ${error.message}`; }
  });
}

export async function initAdmin() {
  const root = document.getElementById('admin-root');
  if (!root) return;
  const current = session();
  if (!current?.access_token || Number(current.expires_at||0) <= Date.now()) { clearSession(); renderLoggedOut(root); return; }
  try { const profile = await verifyRole(current.user.id); await renderDashboard(root, profile); }
  catch (error) { clearSession(); renderLoggedOut(root, error.message); }
}
