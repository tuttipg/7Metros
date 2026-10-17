import { createHash } from 'node:crypto';
import { adaptTournamentTrackerTorneoOffline } from './tournamenttracker-torneo-adapter-core.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_TORNEO_ARTIFACT_BYTES = 4 * 1024 * 1024;

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} inválido`);
  return value.trim();
}

export function verifyAndAdaptTournamentTrackerTorneoArtifactOffline({ rawArtifact, evidence }) {
  requireObject(evidence, 'Evidencia de artefacto');
  if (evidence.source !== 'tournamenttracker_decrypted_torneo_offline') throw new Error('source de evidencia inválido');
  if (evidence.network_used !== false) throw new Error('La evidencia exige network_used=false');
  if (evidence.auth_used !== false) throw new Error('La evidencia no puede usar autenticación');
  if (evidence.write_enabled !== false) throw new Error('La evidencia no puede habilitar escritura');

  if (typeof rawArtifact !== 'string' || !rawArtifact.length) throw new Error('Artefacto Torneo vacío o inválido');
  const bytes = Buffer.byteLength(rawArtifact, 'utf8');
  if (bytes > MAX_TORNEO_ARTIFACT_BYTES) throw new Error('Artefacto Torneo excede límite SAFE de 4 MiB');

  const expectedSha256 = requireString(evidence.artifact_sha256, 'artifact_sha256').toLowerCase();
  if (!SHA256_RE.test(expectedSha256)) throw new Error('artifact_sha256 debe ser SHA-256 hexadecimal');
  if (!Number.isSafeInteger(evidence.artifact_bytes) || evidence.artifact_bytes < 1) throw new Error('artifact_bytes inválido');
  if (evidence.artifact_bytes !== bytes) throw new Error('artifact_bytes no coincide con el cuerpo exacto');

  const actualSha256 = createHash('sha256').update(rawArtifact, 'utf8').digest('hex');
  if (actualSha256 !== expectedSha256) throw new Error('artifact_sha256 no coincide con el cuerpo exacto');

  let torneo;
  try {
    torneo = JSON.parse(rawArtifact);
  } catch {
    throw new Error('Artefacto Torneo no es JSON válido');
  }

  const fixture = adaptTournamentTrackerTorneoOffline({ torneo, evidence });
  return {
    ...fixture,
    provenance: {
      artifact_sha256: actualSha256,
      artifact_bytes: bytes,
      verified_exact_body: true,
      source: evidence.source,
      network_used: false,
      auth_used: false,
      write_enabled: false,
    },
  };
}

export { MAX_TORNEO_ARTIFACT_BYTES };
