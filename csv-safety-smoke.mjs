import assert from 'node:assert/strict';

globalThis.window = {};
const { csvCell } = await import('./utils.js');

assert.equal(csvCell('Ferro Carril Oeste'), '"Ferro Carril Oeste"');
assert.equal(csvCell('Juan "Pepe" Pérez'), '"Juan ""Pepe"" Pérez"');
assert.equal(csvCell('=2+2'), '"\'=2+2"');
assert.equal(csvCell('+SUM(A1:A2)'), '"\'+SUM(A1:A2)"');
assert.equal(csvCell('-10'), '"\'-10"');
assert.equal(csvCell('@SUM(A1:A2)'), '"\'@SUM(A1:A2)"');
assert.equal(csvCell('  =HYPERLINK("https://example.com")'), '"\'  =HYPERLINK(""https://example.com"")"');
assert.equal(csvCell(-10), '"-10"');
assert.equal(csvCell(0), '"0"');
assert.equal(csvCell(null), '""');

console.log('CSV safety smoke test OK');
