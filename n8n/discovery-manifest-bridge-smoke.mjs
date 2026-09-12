import assert from 'node:assert/strict';
import { buildDiscoveryPdfWorkItems } from './discovery-manifest-bridge.mjs';

function manifest(pdfs, overrides = {}) {
  return {
    schema_version: 2,
    safe: true,
    complete: true,
    write_enabled: false,
    auth_used: false,
    pages: [],
    pdfs,
    fetch_errors: [],
    ...overrides,
  };
}

function pdf(overrides = {}) {
  return {
    page_url: 'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',
    page_title: 'Programación Fecha 1 – Torneo Metropolitano Apertura 2026',
    pdf_url: 'https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf',
    anchor_text: 'Sábado 21-3',
    source_type: 'fecha_normal',
    phase: 'apertura',
    round_number: 1,
    ...overrides,
  };
}

{
  const items = buildDiscoveryPdfWorkItems(manifest([pdf()]));
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'femebal_official_pdf');
  assert.equal(items[0].method, 'GET');
  assert.equal(items[0].allow_redirects, false);
  assert.equal(items[0].auth_used, false);
  assert.equal(items[0].write_enabled, false);
  assert.equal(items[0].source.phase, 'apertura');
  assert.equal(items[0].source.round_number, 1);
}

// Duplicado exacto: una sola unidad de trabajo.
{
  const items = buildDiscoveryPdfWorkItems(manifest([pdf(), pdf()]));
  assert.equal(items.length, 1);
}

// Mismo PDF con procedencia contradictoria: no elegir silenciosamente.
assert.throws(
  () => buildDiscoveryPdfWorkItems(manifest([pdf(), pdf({ source_type: 'reprogramacion', phase: null, round_number: null })])),
  /metadatos contradictorios/
);

// Nunca aceptar URLs externas, HTTP, userinfo, puertos extraños o PDFs fuera de uploads.
for (const badUrl of [
  'https://evil.example/wp-content/uploads/2026/03/x.pdf',
  'http://femebal.com/wp-content/uploads/2026/03/x.pdf',
  'https://user:pass@femebal.com/wp-content/uploads/2026/03/x.pdf',
  'https://femebal.com:444/wp-content/uploads/2026/03/x.pdf',
  'https://femebal.com/documentos/x.pdf',
  'https://femebal.com/wp-content/uploads/2026/03/x.pdf?token=abc',
]) {
  assert.throws(() => buildDiscoveryPdfWorkItems(manifest([pdf({ pdf_url: badUrl })])));
}

assert.throws(() => buildDiscoveryPdfWorkItems(manifest([pdf({ page_url: 'https://evil.example/programacion/' })])));
assert.throws(() => buildDiscoveryPdfWorkItems(manifest([pdf({ source_type: 'otro' })])));
assert.throws(() => buildDiscoveryPdfWorkItems(manifest([pdf({ phase: 'final' })])));
assert.throws(() => buildDiscoveryPdfWorkItems(manifest([pdf({ round_number: 0 })])));
assert.throws(() => buildDiscoveryPdfWorkItems(manifest([pdf()], { complete: false })), /incompleto/);
assert.throws(() => buildDiscoveryPdfWorkItems(manifest([pdf()], { write_enabled: true })), /read-only/);
assert.throws(() => buildDiscoveryPdfWorkItems(manifest([pdf()], { auth_used: true })), /autenticación/);

console.log('✓ discovery-manifest bridge: PDF work items SAFE/fail-closed OK');
