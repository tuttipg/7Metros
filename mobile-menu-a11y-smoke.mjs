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
assert.match(ui, /window\.matchMedia\('\(max-width: 980px\)'\)/, 'menu accessibility state must respond to the mobile breakpoint');
assert.match(ui, /requestAnimationFrame\(\(\) => \{[\s\S]*aria-current="page"/, 'opening the drawer should move focus into the navigation');

console.log('Mobile menu accessibility smoke test passed.');
