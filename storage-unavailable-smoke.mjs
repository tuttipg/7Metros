import assert from 'node:assert/strict';
import { readLocalPreference, writeLocalPreference, removeLocalPreference } from './storage-preferences.mjs';

// En algunos navegadores incluso leer window.localStorage lanza SecurityError.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get() { throw new DOMException('Storage blocked', 'SecurityError'); }
});
globalThis.window = globalThis;
window.SEVEN_METROS_CONFIG = {
  seasonId: 3,
  defaults: { categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' }
};

assert.equal(readLocalPreference('x'), null);
assert.equal(writeLocalPreference('x', '1'), false);
assert.equal(removeLocalPreference('x'), false);

// El módulo store antes fallaba durante su import, impidiendo iniciar toda la web.
const store = await import('./store.js');
assert.equal(store.state.filters.categoria, 'Mayores');
assert.equal(store.state.filters.rama, 'M');
assert.doesNotThrow(() => store.persistFilters());
assert.doesNotThrow(() => store.clearStoredFilters());

const toggles = new Map();
globalThis.document = {
  body: { classList: { toggle(name, enabled) { toggles.set(name, enabled); } } }
};
const ui = await import('./ui.js');
assert.doesNotThrow(() => ui.applySettings());
assert.equal(toggles.get('compact-tables'), false);
assert.equal(toggles.get('reduce-motion'), false);

// La preferencia debe aplicarse durante esta visita aunque no pueda persistirse.
assert.equal(writeLocalPreference('7m_setting_motion', '1'), false);
assert.equal(readLocalPreference('7m_setting_motion'), '1');
ui.applySettings();
assert.equal(toggles.get('reduce-motion'), true, 'el modo reducido debe funcionar sin localStorage');
assert.equal(removeLocalPreference('7m_setting_motion'), false);
assert.equal(readLocalPreference('7m_setting_motion'), null);
ui.applySettings();
assert.equal(toggles.get('reduce-motion'), false);

// Si el navegador permite leer pero bloquea escrituras por cuota, tampoco debe fallar.
const values = new Map([['7m_setting_compact', '1']]);
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key) { return values.get(key) ?? null; },
    setItem() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
    removeItem() { throw new DOMException('Storage blocked', 'SecurityError'); }
  }
});
assert.equal(readLocalPreference('7m_setting_compact'), '1');
assert.equal(writeLocalPreference('x', '1'), false);
assert.equal(removeLocalPreference('x'), false);
assert.doesNotThrow(() => ui.applySettings());
assert.equal(toggles.get('compact-tables'), true);
// Con cuota llena, una escritura fallida debe prevalecer sobre el valor viejo
// durante esta visita, sin afirmar que se guardó.
assert.equal(writeLocalPreference('7m_setting_compact', '0'), false);
assert.equal(readLocalPreference('7m_setting_compact'), '0');
ui.applySettings();
assert.equal(toggles.get('compact-tables'), false, 'no debe reaplicar un valor viejo del storage');
assert.equal(writeLocalPreference('7m_setting_compact', '1'), false);
ui.applySettings();
assert.equal(toggles.get('compact-tables'), true);
assert.doesNotThrow(() => store.persistFilters());
assert.doesNotThrow(() => store.clearStoredFilters());

// Restablecer con borrado bloqueado no debe recargar: una recarga recuperaría
// preferencias viejas y anularía el restablecimiento temporal.
const settingChangeHandlers = new Map();
const settingsInputs = ['filters', 'compact', 'motion'].map(setting => ({
  dataset: { setting },
  checked: false,
  addEventListener(event, handler) {
    if (event === 'change') settingChangeHandlers.set(setting, handler);
  }
}));
let resetHandler;
let filtersChanged = 0;
const resetButton = { addEventListener(event, handler) {
  if (event === 'click') resetHandler = handler;
} };
globalThis.document = {
  body: { dataset: { page: 'ajustes' }, classList: { toggle(name, enabled) { toggles.set(name, enabled); } } },
  querySelectorAll(selector) { return selector === '[data-setting]' ? settingsInputs : []; },
  getElementById(id) { return id === 'reset-settings' ? resetButton : null; },
  dispatchEvent(event) { if (event.type === '7m:filters-changed') filtersChanged++; }
};
globalThis.CustomEvent ??= class { constructor(type) { this.type = type; } };
ui.initSettingsPage();
assert.equal(typeof resetHandler, 'function');
// Desactivar "Recordar filtros" debe actualizar las vistas sin navegar ni recargar.
store.state.filters.categoria = 'Cadetes';
settingsInputs[0].checked = false;
settingChangeHandlers.get('filters')();
assert.equal(store.state.filters.categoria, 'Mayores', 'desactivar persistencia restablece filtros activos');
assert.equal(filtersChanged, 1, 'desactivar persistencia debe avisar a las vistas del cambio');
store.state.filters.categoria = 'Cadetes';
const originalSetTimeout = globalThis.setTimeout;
try {
  globalThis.setTimeout = () => { throw new Error('reset must not schedule reload on storage failure'); };
  resetHandler();
} finally {
  globalThis.setTimeout = originalSetTimeout;
}
assert.deepEqual(settingsInputs.map(input => input.checked), [true, false, false]);
assert.equal(store.state.filters.categoria, 'Mayores');
assert.equal(readLocalPreference('7m_setting_compact'), null);
assert.equal(toggles.get('compact-tables'), false);
assert.equal(toggles.get('reduce-motion'), false);
assert.equal(filtersChanged, 2, 'restablecer también debe avisar a las vistas del cambio');

// Flujo normal: las preferencias siguen siendo persistentes cuando hay almacenamiento.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  }
});
assert.equal(writeLocalPreference('x', 'ok'), true);
assert.equal(readLocalPreference('x'), 'ok');
assert.equal(removeLocalPreference('x'), true);
assert.equal(readLocalPreference('x'), null);
store.state.filters.categoria = 'Cadetes';
store.persistFilters();
assert.equal(readLocalPreference('7m_categoria'), 'Cadetes');
store.clearStoredFilters();
assert.equal(readLocalPreference('7m_categoria'), null);

console.log('Storage unavailable smoke: import, lectura, escritura, cuota y preferencias OK');
