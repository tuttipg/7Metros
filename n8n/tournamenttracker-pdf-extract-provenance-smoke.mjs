import assert from 'node:assert/strict';
import { normalizePdfProvenance } from './pdf-extract-contract.mjs';

const url = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const torneoSha = 'a'.repeat(64);
const pdfSha = 'b'.repeat(64);
const workItem = {
  kind: 'tournamenttracker_selected_official_pdf', method: 'GET', url,
  allow_redirects: false, auth_used: false, write_enabled: false, dry_run: true,
  expected_match: { fecha: '2026-03-21', local: 'Argentinos Juniors', visitante: 'Ferro Carril Oeste', goles_local: 20, goles_visitante: 27 },
  source: {
    provenance: 'tournamenttracker_verified_torneo_selection', pdf_url: url,
    torneo_artifact_sha256: torneoSha, torneo_artifact_bytes: 1234,
    torneo_verified_exact_body: true, network_used: false, auth_used: false, write_enabled: false,
  },
};
const artifact = { dry_run: true, write_enabled: false, auth_used: false, source_url: url, content_type: 'application/pdf', byte_length: 4321, sha256: pdfSha };

const provenance = normalizePdfProvenance(artifact, workItem);
assert.equal(provenance.sha256, pdfSha);
assert.equal(provenance.upstream.type, 'tournamenttracker_verified_torneo_selection');
assert.equal(provenance.upstream.torneo_artifact_sha256, torneoSha);
assert.equal(provenance.upstream.torneo_artifact_bytes, 1234);
assert.equal(provenance.upstream.torneo_verified_exact_body, true);
assert.equal(provenance.upstream.network_used, false);
assert.equal(provenance.upstream.auth_used, false);
assert.equal(provenance.upstream.write_enabled, false);

assert.throws(() => normalizePdfProvenance(artifact, { ...workItem, source: { ...workItem.source, torneo_artifact_sha256: 'bad' } }), /SHA-256 Torneo upstream/);
assert.throws(() => normalizePdfProvenance(artifact, { ...workItem, source: { ...workItem.source, torneo_verified_exact_body: false } }), /cuerpo Torneo exacto/);
assert.throws(() => normalizePdfProvenance(artifact, { ...workItem, source: { ...workItem.source, network_used: true } }), /frontera SAFE/);
assert.throws(() => normalizePdfProvenance(artifact, { ...workItem, source: { ...workItem.source, pdf_url: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/otro.pdf' } }), /no coincide/);

console.log('✓ SHA(Torneo) → PDF provenance preservada y fail-closed para partido control 20–27');
