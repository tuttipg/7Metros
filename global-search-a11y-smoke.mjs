import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('./ui.js', import.meta.url), 'utf8');
assert.match(ui, /id="global-search-input"[^>]*aria-label="Buscar jugador o club"/);

const start = ui.indexOf('function initGlobalSearch() {');
const end = ui.indexOf('export function applySettings()', start);
assert.ok(start >= 0 && end > start, 'global search initializer must exist');
const source = ui.slice(start, end);

const listeners = {};
const timers = new Map();
let nextTimer = 0;
let toasts = 0;
let document;

function element() {
  const classes = new Set();
  const events = {};
  return {
    events,
    attrs: {},
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value)
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, fn) { events[name] = fn; },
    focus() { document.activeElement = this; this.focusCount = (this.focusCount || 0) + 1; },
    getClientRects() { return [{}]; },
    isConnected: true,
    innerHTML: '',
    value: ''
  };
}

const root = element();
const modal = element();
const input = element();
const closeButton = element();
const results = element();
const desktopTrigger = element();
const mobileTrigger = element();
const outside = element();
let resultLinks = [];
modal.querySelectorAll = () => [input, closeButton, ...resultLinks];
modal.contains = element => [input, closeButton, ...resultLinks].includes(element);
results.querySelector = () => resultLinks[0] || null;

const elements = {
  'global-search-root': root,
  'global-search-modal': modal,
  'global-search-input': input,
  'global-search-close': closeButton,
  'global-search-results': results,
  'global-search-open': desktopTrigger,
  'mobile-search': mobileTrigger
};

document = {
  activeElement: desktopTrigger,
  body: element(),
  getElementById: id => elements[id] || null,
  addEventListener(name, fn) { listeners[name] = fn; }
};

const state = {
  loaded: true,
  clubs: [],
  players: [],
  index: {
    rosterByPlayer: new Map(),
    teamById: new Map(),
    clubById: new Map()
  }
};

const init = new Function(
  'document', 'state', 'icon', 'normalizeText', 'clubBadge', 'esc', 'initials',
  'showToast', 'setTimeout', 'clearTimeout',
  source + '\nreturn initGlobalSearch;'
)(
  document, state, () => '', value => value, () => '', value => value, () => '',
  () => { toasts++; },
  fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
  id => timers.delete(id)
);
init();

function key(key, options = {}) {
  let prevented = false;
  listeners.keydown({
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...options,
    preventDefault() { prevented = true; }
  });
  return prevented;
}

function flushTimers() {
  for (const [id, fn] of [...timers]) {
    timers.delete(id);
    fn();
  }
}

// Closing before the scheduled focus must not refocus an aria-hidden input.
desktopTrigger.events.click();
assert.equal(modal.classList.contains('show'), true);
assert.equal(modal.attrs['aria-hidden'], 'false');
assert.equal(timers.size, 1);
closeButton.events.click();
assert.equal(modal.classList.contains('show'), false);
assert.equal(modal.attrs['aria-hidden'], 'true');
assert.equal(document.activeElement, desktopTrigger, 'closing restores the original trigger');
assert.equal(timers.size, 0, 'closing cancels pending focus');
flushTimers();
assert.equal(document.activeElement, desktopTrigger);

// Keyboard open: trap Shift+Tab/Tab, including dynamically added search links.
document.activeElement = mobileTrigger;
assert.equal(key('k', { ctrlKey: true }), true);
flushTimers();
assert.equal(document.activeElement, input);
assert.equal(key('Tab', { shiftKey: true }), true);
assert.equal(document.activeElement, closeButton);
assert.equal(key('Tab'), true);
assert.equal(document.activeElement, input);

const link = element();
resultLinks = [link];
link.focus();
assert.equal(key('Tab'), true);
assert.equal(document.activeElement, input, 'Tab from last dynamic result wraps to input');
outside.focus();
assert.equal(key('Tab'), true);
assert.equal(document.activeElement, input, 'focus cannot escape open modal');

// Ctrl+K while open must not overwrite the original return-focus target.
assert.equal(key('k', { ctrlKey: true }), true);
assert.equal(key('Escape'), true);
assert.equal(document.activeElement, mobileTrigger);
assert.equal(document.body.classList.contains('modal-open'), false);
assert.equal(modal.attrs['aria-hidden'], 'true');

// If the opener was removed from DOM, do not try to focus it.
desktopTrigger.isConnected = false;
document.activeElement = desktopTrigger;
desktopTrigger.events.click();
flushTimers();
input.focus();
assert.equal(key('Escape'), true);
assert.equal(document.activeElement, input, 'removed opener is not focused');

// No data: do not open search, show a clear message instead.
state.loaded = false;
mobileTrigger.events.click();
assert.equal(modal.classList.contains('show'), false);
assert.equal(toasts, 1);
console.log('Global search dialog focus, keyboard trap, fast close and no-data smoke tests passed.');
