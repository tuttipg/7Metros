import assert from 'node:assert/strict';
import { fixtureScopeKey, prioritizeFixtureSchedules, validateDiscoveryManifest } from './importer-core.mjs';

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

console.log('✓ importer-core: manifest gate, scopes, reprogramaciones, duplicados y fail-closed OK');
