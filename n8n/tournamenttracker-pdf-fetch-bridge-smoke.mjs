import assert from 'node:assert/strict';
import { buildTournamentTrackerPdfWorkItem } from './tournamenttracker-pdf-work-item-core.mjs';
import { fetchOfficialFemebalPdf } from './official-pdf-fetch-core.mjs';

const PDF_URL = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const ARTIFACT_SHA = 'a'.repeat(64);
const expected = { fecha: '2026-03-21', local: 'Argentinos Juniors', visitante: 'Ferro Carril Oeste', goles_local: 20, goles_visitante: 27 };
const selection = {
  dry_run: true, network_used: false, auth_used: false, write_enabled: false, expected_match_checked: true,
  pdf_url: PDF_URL, expected_match: expected,
  match: { planillas: [{ pdf: PDF_URL }] },
  provenance: { source: 'tournamenttracker_decrypted_torneo_offline', verified_exact_body: true, artifact_sha256: ARTIFACT_SHA, artifact_bytes: 1234, network_used: false, auth_used: false, write_enabled: false },
};
const item = buildTournamentTrackerPdfWorkItem(selection);
const pdfBytes = new TextEncoder().encode('%PDF-1.7\nfixture');
const headers = { get(name) { const values = { 'content-type': 'application/pdf', 'content-length': String(pdfBytes.byteLength) }; return values[String(name).toLowerCase()] ?? null; } };
function response() { let done = false; return { status: 200, headers, body: { getReader() { return { async read() { if (done) return { done: true }; done = true; return { done: false, value: pdfBytes }; }, async cancel() {}, releaseLock() {} }; } } }; }
let seen = null;
const out = await fetchOfficialFemebalPdf(item, { fetchImpl: async (url, options) => { seen = { url, options }; return response(); } });
assert.equal(out.source_url, PDF_URL);
assert.match(out.sha256, /^[0-9a-f]{64}$/);
assert.equal(seen.url, PDF_URL);
assert.equal(seen.options.method, 'GET');
assert.equal(seen.options.redirect, 'manual');
assert.equal(seen.options.credentials, 'omit');
assert.equal('Authorization' in seen.options.headers, false);
assert.equal('Cookie' in seen.options.headers, false);

for (const mutate of [
  x => ({ ...x, dry_run: false }),
  x => ({ ...x, source: { ...x.source, provenance: 'public_explicit_link' } }),
  x => ({ ...x, source: { ...x.source, torneo_verified_exact_body: false } }),
  x => ({ ...x, source: { ...x.source, torneo_artifact_sha256: 'bad' } }),
  x => ({ ...x, source: { ...x.source, network_used: true } }),
]) {
  let networkCalled = false;
  await assert.rejects(() => fetchOfficialFemebalPdf(mutate(item), { fetchImpl: async () => { networkCalled = true; return response(); } }));
  assert.equal(networkCalled, false);
}
console.log('✓ TournamentTracker verified Torneo selection -> official PDF SAFE fetch boundary + SHA-256 + pre-network fail-closed regression OK');
