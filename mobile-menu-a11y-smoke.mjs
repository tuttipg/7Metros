import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync(new URL('./ui.js', import.meta.url), 'utf8');

assert.match(ui, /id="menu-open"[^>]*aria-controls="sidebar"[^>]*aria-expanded="false"/, 'mobile menu button must expose aria-controls and collapsed state');
assert.match(ui, /menuOpen\?\.setAttribute\('aria-expanded', String\(shouldOpen\)\)/, 'menu state must keep aria-expanded synchronized');
assert.match(ui, /event\.key === 'Escape' && sidebar\?\.classList\.contains\('open'\)/, 'Escape must close an open mobile menu');
assert.match(ui, /closeMenu\(\{ returnFocus: true \}\)/, 'keyboard/overlay close path must request focus restoration');
assert.match(ui, /if \(returnFocus\) menuOpen\?\.focus\(\)/, 'closing the menu must be able to return focus to its trigger');
assert.match(ui, /sidebar\.inert = hidden/, 'hidden mobile navigation must be removed from the focus order');
assert.match(ui, /document\.body\.classList\.toggle\('nav-open'/, 'open mobile navigation must lock page scrolling');
// El sidebar pasa a drawer en CSS a 940px. Entre 941 y 980px antes era visible
// pero aria-hidden/inert, lo que impedía navegarlo con teclado.
const drawerCss = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const accessibilityBreakpoint = ui.match(/window\.matchMedia\('\(max-width: (\d+)px\)'\)/);
const drawerBreakpoint = drawerCss.match(/@media\(max-width:(\d+)px\)\{\s*:root\{--sidebar:0px\}/);
assert.ok(accessibilityBreakpoint, 'JS must define the mobile navigation breakpoint');
assert.ok(drawerBreakpoint, 'CSS must define the sidebar drawer breakpoint');
assert.equal(accessibilityBreakpoint[1], drawerBreakpoint[1], 'visible desktop sidebar must never be aria-hidden/inert');
for (const width of [320, 940, 941, 960, 980, 1200]) {
  const cssDrawer = width <= Number(drawerBreakpoint[1]);
  const jsMobile = width <= Number(accessibilityBreakpoint[1]);
  assert.equal(jsMobile, cssDrawer, `sidebar accessibility must match CSS at ${width}px`);
}
assert.match(ui, /requestAnimationFrame\(\(\) => \{[\s\S]*aria-current="page"/, 'opening the drawer should move focus into the navigation');

// El indicador del sidebar debe reflejar el estado real, no afirmar conexión
// antes de terminar la carga o después de un fallo.
const bootstrap = fs.readFileSync(new URL('./script.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
assert.match(bootstrap, /data-connection-state="loading"/, 'bootstrap starts with a pending state');
assert.match(bootstrap, /indicator\.dataset\.connectionState = 'error'/, 'bootstrap failure must mark data unavailable');
assert.match(styles, /data-connection-state="loading"/, 'pending indicator must not look connected');
assert.match(styles, /data-connection-state="error"/, 'failed indicator must not look connected');

globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null };
globalThis.SEVEN_METROS_CONFIG = {
  seasonId: 3,
  defaults: { categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' }
};
const { setConnectionStatus, renderLoadingStatus, renderSuccessStatus, renderErrorStatus } = await import('./ui.js');
const label = { textContent: '' };
const indicator = {
  dataset: { connectionState: 'loading' },
  querySelector: selector => selector === '.connection-label' ? label : null
};
const statusRoot = { innerHTML: '' };
globalThis.document = {
  querySelector: selector => selector === '.sidebar-foot' ? indicator : null,
  querySelectorAll: () => [],
  getElementById: id => id === 'data-status' ? statusRoot : null
};
renderLoadingStatus();
assert.equal(indicator.dataset.connectionState, 'loading');
assert.equal(label.textContent, 'Conectando datos…');
renderSuccessStatus();
assert.equal(indicator.dataset.connectionState, 'ready');
assert.equal(label.textContent, 'Datos disponibles');
renderErrorStatus(new Error('servicio no disponible'));
assert.equal(indicator.dataset.connectionState, 'error');
assert.equal(label.textContent, 'Datos no disponibles');
setConnectionStatus('invalid');
assert.equal(indicator.dataset.connectionState, 'error', 'unknown status must not overwrite a known state');

// Regresión funcional: el botón que anuncia «Cerrar menú» debe cerrarlo al
// segundo clic. Un requestAnimationFrame pendiente no debe enfocar el drawer cerrado.
const makeClasses = () => {
  const values = new Set();
  return {
    contains: name => values.has(name),
    add: name => values.add(name),
    remove: name => values.delete(name),
    toggle: (name, force) => {
      const enabled = force === undefined ? !values.has(name) : Boolean(force);
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    }
  };
};
const listeners = {};
const attributes = {};
let triggerFocus = 0;
let drawerFocus = 0;
const frameQueue = [];
const sidebar = {
  innerHTML: '',
  classList: makeClasses(),
  inert: false,
  setAttribute: (name, value) => { attributes[name] = value; },
  querySelectorAll: () => [],
  querySelector: () => ({ focus: () => { drawerFocus++; } })
};
const trigger = {
  attributes: {},
  addEventListener: (name, handler) => { listeners[name] = handler; },
  setAttribute(name, value) { this.attributes[name] = value; },
  focus: () => { triggerFocus++; }
};
const overlay = { classList: makeClasses(), addEventListener: () => {} };
const mobile = { innerHTML: '' };
const media = { matches: true, addEventListener: () => {} };
globalThis.matchMedia = () => media;
globalThis.requestAnimationFrame = callback => { frameQueue.push(callback); };
globalThis.document = {
  body: { dataset: { page: 'inicio' }, classList: makeClasses() },
  getElementById: id => ({
    sidebar, 'mobile-bar': mobile, overlay, 'menu-open': trigger
  })[id] || null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
const { renderShell } = await import('./ui.js');
renderShell();
assert.equal(sidebar.inert, true, 'closed mobile drawer must be inert');
assert.equal(trigger.attributes['aria-expanded'], 'false');
assert.equal(typeof listeners.click, 'function', 'menu trigger must have a click handler');

listeners.click();
assert.equal(sidebar.classList.contains('open'), true, 'first click opens the drawer');
assert.equal(trigger.attributes['aria-expanded'], 'true');
assert.equal(trigger.attributes['aria-label'], 'Cerrar menú');
assert.equal(sidebar.inert, false);

listeners.click();
assert.equal(sidebar.classList.contains('open'), false, 'second click closes the drawer');
assert.equal(trigger.attributes['aria-expanded'], 'false');
assert.equal(trigger.attributes['aria-label'], 'Abrir menú');
assert.equal(sidebar.inert, true);
assert.equal(triggerFocus, 1, 'closing via trigger restores focus');
frameQueue.splice(0).forEach(callback => callback());
assert.equal(drawerFocus, 0, 'late animation frame must not focus closed drawer');

listeners.click();
frameQueue.splice(0).forEach(callback => callback());
assert.equal(drawerFocus, 1, 'opening the drawer should focus its navigation');

console.log('Mobile menu accessibility, toggle and connection-state smoke tests passed.');
