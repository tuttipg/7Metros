import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyAndAdaptTournamentTrackerTorneoArtifactOffline, MAX_TORNEO_ARTIFACT_BYTES } from './tournamenttracker-torneo-artifact-core.mjs';
import { validateTournamentTrackerFixtureOffline } from './tournamenttracker-fixture-validator-core.mjs';

const torneo = {
  id: '775',
  fases: [{ id: 'fase-a', zonas: [{ id: 'zona-a', partidos: [{
    id: 'control-match', numeroFecha: '1', horario: '2026-03-21T20:15:00',
    nombreLocal: 'Argentinos Juniors', nombreVisitante: 'Ferro Carril Oeste',
    golesLocal: '20', golesVisitante: '27',
    planillas: [{ pdf: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf' }],
  }] }] }],
};
const rawArtifact = JSON.stringify(torneo);
const sha256 = createHash('sha256').update(rawArtifact, 'utf8').digest('hex');
const evidence = {
  source: 'tournamenttracker_decrypted_torneo_offline', network_used: false, auth_used: false, write_enabled: false,
  artifact_sha256: sha256, artifact_bytes: Buffer.byteLength(rawArtifact, 'utf8'),
};

const fixture = verifyAndAdaptTournamentTrackerTorneoArtifactOffline({ rawArtifact, evidence });
assert.equal(fixture.provenance.verified_exact_body, true);
assert.equal(fixture.provenance.artifact_sha256, sha256);
assert.equal(fixture.partidos.length, 1);
const validated = validateTournamentTrackerFixtureOffline({ fixture, expected: {
  fecha: '2026-03-21', local: 'Argentinos Juniors', visitante: 'Ferro Carril Oeste', goles_local: 20, goles_visitante: 27,
} });
assert.match(validated.pdf_url, /5ce377051ea0acb1\.pdf$/);

assert.throws(() => verifyAndAdaptTournamentTrackerTorneoArtifactOffline({ rawArtifact: `${rawArtifact} `, evidence }), /artifact_bytes no coincide/);
assert.throws(() => verifyAndAdaptTournamentTrackerTorneoArtifactOffline({ rawArtifact, evidence: { ...evidence, artifact_sha256: '0'.repeat(64) } }), /artifact_sha256 no coincide/);
assert.throws(() => verifyAndAdaptTournamentTrackerTorneoArtifactOffline({ rawArtifact, evidence: { ...evidence, artifact_bytes: evidence.artifact_bytes + 1 } }), /artifact_bytes no coincide/);
assert.throws(() => verifyAndAdaptTournamentTrackerTorneoArtifactOffline({ rawArtifact, evidence: { ...evidence, network_used: true } }), /network_used=false/);
assert.throws(() => verifyAndAdaptTournamentTrackerTorneoArtifactOffline({ rawArtifact: 'x'.repeat(MAX_TORNEO_ARTIFACT_BYTES + 1), evidence }), /límite SAFE/);

const invalidJson = '{"id":"775"';
const invalidEvidence = { ...evidence, artifact_sha256: createHash('sha256').update(invalidJson).digest('hex'), artifact_bytes: Buffer.byteLength(invalidJson) };
assert.throws(() => verifyAndAdaptTournamentTrackerTorneoArtifactOffline({ rawArtifact: invalidJson, evidence: invalidEvidence }), /JSON válido/);

console.log('TournamentTracker Torneo exact-artifact provenance smoke: OK');
