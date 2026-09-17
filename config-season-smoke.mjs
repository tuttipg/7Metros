import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./config.js', import.meta.url), 'utf8')
  .replaceAll('export const ', 'const ')
  + '\n;globalThis.__seasonId = SEASON_ID;';

function evaluateSeasonId(config) {
  const context = vm.createContext({ window: { SEVEN_METROS_CONFIG: config } });
  vm.runInContext(source, context, { filename: 'config.js' });
  return context.__seasonId;
}

assert.equal(evaluateSeasonId({}), 3, 'missing seasonId must fall back to 3');
assert.equal(evaluateSeasonId({ seasonId: null }), 3, 'null seasonId must fall back to 3');
assert.equal(evaluateSeasonId({ seasonId: 0 }), 0, 'explicit 0 must not silently fall back');
assert.equal(evaluateSeasonId({ seasonId: 7 }), 7, 'valid explicit seasonId must be preserved');

console.log('config season smoke: ok');
