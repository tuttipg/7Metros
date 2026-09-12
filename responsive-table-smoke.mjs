import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('./v3.css', import.meta.url), 'utf8');

assert.match(css, /\.table-scroll\s*\{[^}]*overflow-x\s*:\s*auto/si, 'table-scroll must allow horizontal scrolling');
assert.match(css, /\.table-scroll\s*\{[^}]*max-width\s*:\s*100%/si, 'table-scroll must stay within its parent width');
assert.match(css, /\.table-scroll\s*\{[^}]*-webkit-overflow-scrolling\s*:\s*touch/si, 'table-scroll must support touch momentum scrolling');
assert.match(css, /\.table-scroll\s*>\s*\.data-table\s*\{[^}]*min-width\s*:\s*720px/si, 'wide tables need a safe minimum width');
assert.match(css, /\.table-scroll\s*>\s*\.data-table\.compact\s*\{[^}]*min-width\s*:\s*560px/si, 'compact tables need a smaller safe minimum width');

console.log('Responsive table contract OK');
