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
assert.doesNotThrow(() => store.persistFilters());
assert.doesNotThrow(() => store.clearStoredFilters());

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
