import assert from 'node:assert/strict';
import { buildDiscoveryPdfWorkItems } from './discovery-manifest-bridge.mjs';

const CONTROL_PDF='https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const CONTROL_SCHEDULE_PDF='https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf';
function manifest(pdfs, overrides={}) { return {schema_version:2,safe:true,complete:true,write_enabled:false,auth_used:false,pages:[],pdfs,fetch_errors:[],...overrides}; }
function pdf(overrides={}) { return {page_url:'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',page_title:'Programación Fecha 1 – Torneo Metropolitano Apertura 2026',pdf_url:CONTROL_PDF,anchor_text:'Sábado 21-3',source_type:'fecha_normal',phase:'apertura',round_number:1,provenance:'public_explicit_link',...overrides}; }

{
  const items=buildDiscoveryPdfWorkItems(manifest([pdf({document_type:'planilla_partido_pdf'})]));
  assert.equal(items.length,1); assert.equal(items[0].kind,'femebal_official_pdf'); assert.equal(items[0].method,'GET');
  assert.equal(items[0].allow_redirects,false); assert.equal(items[0].auth_used,false); assert.equal(items[0].write_enabled,false);
  assert.equal(items[0].url,CONTROL_PDF); assert.equal(items[0].source.provenance,'public_explicit_link');
}
{
  const items=buildDiscoveryPdfWorkItems(manifest([pdf({pdf_url:CONTROL_SCHEDULE_PDF,document_type:'programacion_pdf'}),pdf({document_type:'planilla_partido_pdf'})]));
  assert.equal(items.length,1); assert.equal(items[0].url,CONTROL_PDF);
}
assert.deepEqual(buildDiscoveryPdfWorkItems(manifest([pdf({pdf_url:CONTROL_SCHEDULE_PDF,document_type:'programacion_pdf'})])),[]);
assert.throws(()=>buildDiscoveryPdfWorkItems(manifest([pdf({provenance:'known_test_fixture'})])),/provenance inválida/);
assert.throws(()=>buildDiscoveryPdfWorkItems(manifest([pdf({provenance:null})])),/provenance inválida/);
assert.throws(()=>buildDiscoveryPdfWorkItems(manifest([pdf({pdf_url:CONTROL_SCHEDULE_PDF,document_type:'planilla_partido_pdf'})])),/document_type contradictorio/);
assert.throws(()=>buildDiscoveryPdfWorkItems(manifest([pdf({document_type:'programacion_pdf'})])),/document_type contradictorio/);
assert.throws(()=>buildDiscoveryPdfWorkItems(manifest([pdf({source_type:'otro'})])),/source_type inválido/);
assert.throws(()=>buildDiscoveryPdfWorkItems(manifest([pdf()],{complete:false})),/incompleto/);
assert.throws(()=>buildDiscoveryPdfWorkItems(manifest([pdf()],{write_enabled:true})),/read-only/);
assert.throws(()=>buildDiscoveryPdfWorkItems(manifest([pdf()],{auth_used:true})),/autenticación/);
console.log('✓ discovery-manifest bridge: explicit public provenance + document_type fail-closed + SAFE OK');
