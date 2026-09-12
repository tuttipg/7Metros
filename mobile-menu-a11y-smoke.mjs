import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync(new URL('./ui.js', import.meta.url), 'utf8');

assert.match(ui, /id="menu-open"[^>]*aria-controls="sidebar"[^>]*aria-expanded="false"/, 'mobile menu button must expose aria-controls and collapsed state');
assert.match(ui, /menuOpen\?\.setAttribute\('aria-expanded', String\(open\)\)/, 'menu state must keep aria-expanded synchronized');
assert.match(ui, /event\.key === 'Escape' && sidebar\?\.classList\.contains\('open'\)/, 'Escape must close an open mobile menu');
assert.match(ui, /closeMenu\(\{ returnFocus: true \}\)/, 'keyboard/overlay close path must request focus restoration');
assert.match(ui, /if \(returnFocus\) menuOpen\?\.focus\(\)/, 'closing the menu must be able to return focus to its trigger');

console.log('Mobile menu accessibility smoke test passed.');
