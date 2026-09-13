import assert from 'node:assert/strict';
import { buildDiscoveryPdfWorkItems } from './discovery-manifest-bridge.mjs';

const CONTROL_PDF='https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';

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
    pdf_url: CONTROL_PDF,
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
  assert.equal(items[0].url, CONTROL_PDF);
  assert.equal(items[0].source.phase, 'apertura');
  assert.equal(items[0].source.round_number, 1);
}

{
  const items = buildDiscoveryPdfWorkItems(manifest([pdf(), pdf()]));
  assert.equal(items.length, 1);
}

assert.throws(
  () => buildDiscoveryPdfWorkItems(manifest([pdf(), pdf({ source_type: 'reprogramacion', phase: null, round_number: null })])),
  /metadatos contradictorios/
);

for (const badUrl of [
  'https://evil.example/pdf_planillas/5/c/e/x.pdf',
  'https://another.cloudfront.net/pdf_planillas/5/c/e/x.pdf',
  'http://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/x.pdf',
  'https://user:pass@djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/x.pdf',
  'https://djfhz848yeeat.cloudfront.net:444/pdf_planillas/5/c/e/x.pdf',
  'https://djfhz848yeeat.cloudfront.net/documentos/x.pdf',
  'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/x.pdf?token=abc',
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

console.log('✓ discovery-manifest bridge: host oficial de planillas + work items SAFE/fail-closed OK');
