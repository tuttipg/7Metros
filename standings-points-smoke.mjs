import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('./store.js', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('./supabase/migrations/20260912_fix_femebal_standings_points.sql', import.meta.url),
  'utf8'
).toLowerCase();

assert.match(
  store,
  /points:\s*won\s*\*\s*3\s*\+\s*drawn\s*\*\s*2\s*\+\s*lost/,
  'El frontend debe aplicar 3 puntos por victoria, 2 por empate y 1 por derrota ordinaria'
);
assert.doesNotMatch(
  store,
  /points:\s*won\s*\*\s*2\s*\+\s*drawn/,
  'No debe reaparecer el esquema incorrecto 2-1-0'
);
assert.match(
  migration,
  /coalesce\(a\.pg,[^)]*\)\s*\*\s*3[\s\S]*coalesce\(a\.pe,[^)]*\)\s*\*\s*2[\s\S]*coalesce\(a\.pp,[^)]*\)\s+as\s+puntos/,
  'La vista v_standings debe usar el mismo esquema 3-2-1'
);
assert.match(
  migration,
  /alter\s+view\s+public\.v_standings\s+set\s*\(security_invoker\s*=\s*true\)/,
  'La migración debe preservar SECURITY INVOKER en v_standings'
);
assert.match(
  migration,
  /no presentación|no-presentación/,
  'La migración debe documentar que la no-presentación necesita tratamiento explícito'
);

console.log('✓ standings-points-smoke: frontend/v_standings 3-2-1 y security_invoker protegidos');
