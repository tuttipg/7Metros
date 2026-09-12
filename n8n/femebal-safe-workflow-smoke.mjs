import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('./femebal-safe-pdf-extraction.workflow.json', import.meta.url);
const workflow = JSON.parse(await readFile(path, 'utf8'));

assert.equal(workflow.active, false, 'El workflow SAFE debe permanecer inactivo por defecto');
assert.ok(Array.isArray(workflow.nodes) && workflow.nodes.length > 0, 'Workflow sin nodos');

const forbiddenNodeFragments = ['supabase', 'postgres', 'mysql', 'httpRequest', 'writeBinaryFile', 'readWriteFile', 'webhook'];
const allowedTypes = new Set([
  'n8n-nodes-base.executeWorkflowTrigger',
  'n8n-nodes-base.code',
  'n8n-nodes-base.extractFromFile',
  'n8n-nodes-base.merge',
]);

for (const node of workflow.nodes) {
  assert.ok(allowedTypes.has(node.type), `Tipo de nodo no permitido en blueprint SAFE: ${node.type}`);
  for (const fragment of forbiddenNodeFragments) {
    assert.ok(!node.type.toLowerCase().includes(fragment.toLowerCase()), `Nodo prohibido: ${node.type}`);
  }
  assert.equal(Object.hasOwn(node, 'credentials'), false, `Nodo ${node.name} no debe contener credentials`);
}

const serialized = JSON.stringify(workflow).toLowerCase();
for (const secretMarker of ['authorization', 'bearer ', 'cookie', 'api_key', 'apikey', 'access_token', 'service_role']) {
  assert.ok(!serialized.includes(secretMarker), `El workflow contiene marcador sensible/prohibido: ${secretMarker}`);
}

const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
const extract = byName.get('Extract PDF');
assert.ok(extract, 'Falta nodo Extract PDF');
assert.equal(extract.type, 'n8n-nodes-base.extractFromFile');
assert.equal(extract.parameters?.operation, 'pdf');
assert.equal(extract.parameters?.binaryPropertyName, 'data');

const preserveCode = byName.get('Preserve SAFE Envelope')?.parameters?.jsCode ?? '';
for (const guard of ['dry_run !== true', 'write_enabled !== false', 'auth_used !== false', "^[0-9a-f]{64}$"]) {
  assert.ok(preserveCode.includes(guard), `Falta guard SAFE en Preserve SAFE Envelope: ${guard}`);
}

const validateCode = byName.get('Validate SAFE Correlation')?.parameters?.jsCode ?? '';
for (const guard of ['dry_run !== true', 'write_enabled !== false', 'auth_used !== false', 'Correlación SHA-256 perdida', 'no produjo texto']) {
  assert.ok(validateCode.includes(guard), `Falta guard SAFE en Validate SAFE Correlation: ${guard}`);
}

const inputTargets = workflow.connections?.['SAFE PDF Input']?.main?.[0]?.map((edge) => edge.node) ?? [];
assert.deepEqual(new Set(inputTargets), new Set(['Preserve SAFE Envelope', 'Extract PDF']), 'El input debe bifurcar envelope y binario');

assert.equal(workflow.connections?.['Preserve SAFE Envelope']?.main?.[0]?.[0]?.node, 'Rejoin Envelope + Extraction');
assert.equal(workflow.connections?.['Preserve SAFE Envelope']?.main?.[0]?.[0]?.index, 0);
assert.equal(workflow.connections?.['Extract PDF']?.main?.[0]?.[0]?.node, 'Rejoin Envelope + Extraction');
assert.equal(workflow.connections?.['Extract PDF']?.main?.[0]?.[0]?.index, 1);
assert.equal(workflow.connections?.['Rejoin Envelope + Extraction']?.main?.[0]?.[0]?.node, 'Validate SAFE Correlation');

const merge = byName.get('Rejoin Envelope + Extraction');
assert.equal(merge?.parameters?.mode, 'combine');
assert.equal(merge?.parameters?.combineBy, 'combineByPosition');

assert.match(workflow.meta?.validated_against ?? '', /Argentinos Juniors 20-27 Ferro/);
assert.match(workflow.meta?.validated_against ?? '', /2026-03-21/);

console.log('FEMEBAL SAFE n8n workflow topology smoke test: OK');
