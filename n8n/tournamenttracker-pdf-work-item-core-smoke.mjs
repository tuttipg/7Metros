import assert from 'node:assert/strict';
import { buildTournamentTrackerPdfWorkItem } from './tournamenttracker-pdf-work-item-core.mjs';

const PDF='https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const base={
  dry_run:true,network_used:false,auth_used:false,write_enabled:false,expected_match_checked:true,
  expected_match:{fecha:'2026-03-21',local:'Argentinos Juniors',visitante:'Ferro Carril Oeste',goles_local:20,goles_visitante:27},
  match:{fecha:'2026-03-21',local:'Argentinos Juniors',visitante:'Ferro Carril Oeste',goles_local:20,goles_visitante:27,planillas:[{pdf:PDF}]},
  pdf_url:PDF,
  provenance:{artifact_sha256:'a'.repeat(64),artifact_bytes:1234,verified_exact_body:true,source:'tournamenttracker_decrypted_torneo_offline',network_used:false,auth_used:false,write_enabled:false},
};
const out=buildTournamentTrackerPdfWorkItem(base);
assert.equal(out.kind,'tournamenttracker_selected_official_pdf');
assert.equal(out.method,'GET');assert.equal(out.allow_redirects,false);assert.equal(out.auth_used,false);assert.equal(out.write_enabled,false);assert.equal(out.dry_run,true);
assert.equal(out.url,PDF);assert.equal(out.source.pdf_url,PDF);assert.equal(out.source.provenance,'tournamenttracker_verified_torneo_selection');
assert.equal(out.source.torneo_artifact_sha256,'a'.repeat(64));assert.equal(out.source.torneo_artifact_bytes,1234);assert.equal(out.source.torneo_verified_exact_body,true);
assert.deepEqual(out.expected_match,base.expected_match);

for (const [patch,re] of [
  [{network_used:true},/network_used=false/],[{auth_used:true},/autenticación/],[{write_enabled:true},/escritura/],[{expected_match_checked:false},/partido esperado/],
  [{provenance:{...base.provenance,verified_exact_body:false}},/verified_exact_body/],
  [{provenance:{...base.provenance,artifact_sha256:'bad'}},/artifact_sha256/],
  [{pdf_url:'https://another.cloudfront.net/pdf_planillas/x.pdf'},/allowlist/],
  [{match:{...base.match,planillas:[{pdf:'https://djfhz848yeeat.cloudfront.net/pdf_planillas/other.pdf'}]}},/no coincide/],
  [{match:{...base.match,visitante:'SAG Villa Ballester'}},/expected_match no coincide.*visitante/],
  [{match:{...base.match,goles_local:21}},/expected_match no coincide.*goles_local/],
  [{expected_match:{...base.expected_match,fecha:'2026-03-22'}},/expected_match no coincide.*fecha/],
  [{expected_match:{...base.expected_match,goles_visitante:-1}},/goles_visitante inválido/],
  [{expected_match:{...base.expected_match,goles_local:20.5}},/goles_local inválido/],
]) await assert.rejects(async()=>buildTournamentTrackerPdfWorkItem({...base,...patch}),re);

console.log('✓ TournamentTracker identity binding + SAFE/fail-closed regressions OK');
