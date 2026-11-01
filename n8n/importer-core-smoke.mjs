import assert from 'node:assert/strict';
import { fixtureScopeKey, prioritizeFixtureSchedules, scheduleKey, validateDiscoveryManifest } from './importer-core.mjs';

function fixture(overrides = {}) {
  return {
    fecha: '2026-09-05',
    hora: '18:00',
    categoria: 'Mayores',
    division: 'LHC Hipotecario Seguros',
    rama: 'M',
    local: 'Ferro Carril Oeste',
    visitante: 'SAG Villa Ballester',
    local_equipo_codigo: 'A',
    visitante_equipo_codigo: 'A',
    tipo_fuente: 'fecha_normal',
    ...overrides,
  };
}

function safeManifest(overrides = {}) {
  return {
    schema_version: 2,
    safe: true,
    complete: true,
    write_enabled: false,
    auth_used: false,
    pages: [],
    pdfs: [],
    fetch_errors: [],
    ...overrides,
  };
}

{
  const result = validateDiscoveryManifest(safeManifest({
    pages: [{ page_url: 'https://femebal.com/programacion-fecha-1/' }],
    pdfs: [{ pdf_url: 'https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf' }],
  }));
  assert.equal(result.schema_version, 2);
  assert.equal(result.safe, true);
  assert.equal(result.complete, true);
  assert.equal(result.write_enabled, false);
  assert.equal(result.auth_used, false);
  assert.equal(result.page_count, 1);
  assert.equal(result.pdf_count, 1);
}

for (const bad of [
  null,
  safeManifest({ schema_version: 1 }),
  safeManifest({ safe: false }),
  safeManifest({ complete: false }),
  safeManifest({ write_enabled: true }),
  safeManifest({ auth_used: true }),
  safeManifest({ fetch_errors: [{ stage: 'fetch_page' }] }),
  safeManifest({ pages: null }),
]) {
  assert.throws(() => validateDiscoveryManifest(bad));
}

{
  const result = prioritizeFixtureSchedules([
    fixture(),
    fixture({ categoria: 'Juveniles', division: 'A', fecha: '2026-09-06' }),
  ]);
  assert.equal(result.selected.length, 2);
  assert.equal(result.ambiguous.length, 0);
}

{
  const result = prioritizeFixtureSchedules([
    fixture({ local_equipo_id: 10, visitante_equipo_id: 20 }),
    fixture({
      local_equipo_id: 10,
      visitante_equipo_id: 20,
      fecha: '2026-09-10',
      hora: '20:30',
      tipo_fuente: 'reprogramacion',
    }),
  ]);
  assert.equal(result.selected.length, 1);
  assert.equal(result.ambiguous.length, 0);
  assert.equal(result.selected[0].tipo_fuente, 'reprogramacion');
  assert.equal(result.selected[0].fecha, '2026-09-10');
  assert.equal(result.selected[0].fecha_programacion_original, '2026-09-05');
}

{
  const result = prioritizeFixtureSchedules([
    fixture({
      local_equipo_id: 10,
      visitante_equipo_id: 20,
      fecha: '2026-09-10',
      tipo_fuente: 'reprogramacion',
    }),
    fixture({
      local_equipo_id: 10,
      visitante_equipo_id: 20,
      fecha: '2026-09-11',
      tipo_fuente: 'reprogramacion',
    }),
  ]);
  assert.equal(result.selected.length, 0);
  assert.equal(result.ambiguous.length, 1);
  assert.equal(result.ambiguous[0].tipo, 'multiples_reprogramaciones');
}

{
  const duplicated = fixture({ local_equipo_id: 10, visitante_equipo_id: 20 });
  const result = prioritizeFixtureSchedules([duplicated, { ...duplicated }]);
  assert.equal(result.selected.length, 1);
  assert.equal(result.ambiguous.length, 0);
}

assert.notEqual(fixtureScopeKey(fixture()), fixtureScopeKey(fixture({ local_equipo_codigo: 'B' })));
assert.throws(() => prioritizeFixtureSchedules([fixture({ categoria: '' })]), /categoria/);
assert.throws(() => prioritizeFixtureSchedules([fixture({ rama: 'X' })]), /Rama inválida/);
assert.throws(() => prioritizeFixtureSchedules([fixture({ local_equipo_id: 10, visitante_equipo_id: null })]), /un solo equipo_id/);
assert.throws(() => prioritizeFixtureSchedules([fixture({ local_equipo_id: 10, visitante_equipo_id: 10 })]), /mismo equipo/);

// Regression: Number() no debe fabricar IDs desde formatos ambiguos.
for (const malformed of [
  '1e1', '0x10', '01', '+10', ' 10', '10 ', ' ', '10.0', '10\n',
  true, false, {}, [], Number.MAX_SAFE_INTEGER + 1, 1.5, 0, -10, NaN, Infinity,
  '9007199254740992'
]) {
  assert.throws(
    () => fixtureScopeKey(fixture({ local_equipo_id: malformed, visitante_equipo_id: 20 })),
    /local_equipo_id inválido/,
    `local ID inválido debe fallar cerrado: ${String(malformed)}`
  );
  assert.throws(
    () => fixtureScopeKey(fixture({ local_equipo_id: 10, visitante_equipo_id: malformed })),
    /visitante_equipo_id inválido/,
    `visitante ID inválido debe fallar cerrado: ${String(malformed)}`
  );
}
assert.equal(fixtureScopeKey(fixture({ local_equipo_id: '10', visitante_equipo_id: '20' })), 'ids|M|mayores|lhc hipotecario seguros|10|20');
assert.notEqual(
  fixtureScopeKey(fixture({ local_equipo_id: 10, visitante_equipo_id: 20 })),
  fixtureScopeKey(fixture({ local_equipo_id: 10, visitante_equipo_id: 20, categoria: 'Juveniles' }))
);
assert.notEqual(
  fixtureScopeKey(fixture({ local_equipo_id: 10, visitante_equipo_id: 20 })),
  fixtureScopeKey(fixture({ local_equipo_id: 10, visitante_equipo_id: 20, division: 'A' }))
);
assert.notEqual(
  fixtureScopeKey(fixture({ local_equipo_id: 10, visitante_equipo_id: 20 })),
  fixtureScopeKey(fixture({ local_equipo_id: 10, visitante_equipo_id: 20, rama: 'F' }))
);
assert.match(fixtureScopeKey(fixture({ local_equipo_id: '', visitante_equipo_id: null })), /^scope\|/);

// Regression: scheduleKey debe rechazar fechas imposibles y horas malformadas,
// pero conservar la equivalencia HH:mm / HH:mm:ss y el caso sin hora.
assert.equal(scheduleKey(fixture({ fecha: '2026-09-05', hora: '18:00' })), '2026-09-05|18:00');
assert.equal(scheduleKey(fixture({ fecha: '2026-09-05', hora: '18:00:00' })), '2026-09-05|18:00');
assert.equal(scheduleKey(fixture({ fecha: '2026-09-05', hora: '' })), '2026-09-05|sin-hora');
assert.equal(scheduleKey(fixture({ fecha: '2026-09-05', hora: '   ' })), '2026-09-05|sin-hora');
for (const badDate of ['2026-2-05', '2026-02-30', '2026-13-01', '0000-01-01', 'yesterday']) {
  assert.throws(() => scheduleKey(fixture({ fecha: badDate })), /Fecha de fixture/);
}
for (const badTime of ['18:00junk', '24:00', '18:60', '18:00:99', '6:00', '18']) {
  assert.throws(() => scheduleKey(fixture({ hora: badTime })), /Hora de fixture/);
}

console.log('✓ importer-core: manifest gate, strict IDs, scopes, schedules, reprogramaciones, duplicados y fail-closed OK');
