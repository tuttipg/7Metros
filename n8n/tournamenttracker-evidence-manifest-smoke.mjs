import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';
import { canonicalizeIndexedTournamentTrackerRoute } from './tournamenttracker-indexed-route-core.mjs';

const manifest = JSON.parse(await readFile(new URL('../config/femebal-public-tournamenttracker-evidence.json', import.meta.url), 'utf8'));

assert.equal(manifest.schema_version, 1);
assert.equal(manifest.safe, true);
assert.equal(manifest.dry_run, true);
assert.equal(manifest.auth_used, false);
assert.equal(manifest.write_enabled, false);
assert.equal(manifest.automatic_probe_allowed, false);

assert.match(manifest.observed_at, /^\d{4}-\d{2}-\d{2}$/);
assert.match(manifest.source?.published, /^\d{4}-\d{2}-\d{2}$/);
const sourceCanonical = canonicalizeOfficialFemebalUrl(manifest.source?.url);
const source = new URL(sourceCanonical);
assert.equal(source.search, '', 'La evidencia explícita no debe depender de query params');
assert.equal(source.pathname.startsWith('/tournament-tracker/'), false, 'La fuente no puede ser circular');
assert.ok(Array.isArray(manifest.routes) && manifest.routes.length > 0);

const seenCanonical = new Set();
for (const route of manifest.routes) {
  assert.equal(typeof route.competition, 'string');
  assert.ok(route.competition.length > 0);
  assert.ok(['Caballeros', 'Damas'].includes(route.branch));
  const canonicalFromObserved = canonicalizeIndexedTournamentTrackerRoute(route.observed_url);
  const canonicalDeclared = canonicalizeIndexedTournamentTrackerRoute(route.canonical_url);
  assert.equal(canonicalFromObserved, canonicalDeclared);
  assert.equal(route.canonical_url, canonicalDeclared);
  assert.equal(seenCanonical.has(canonicalDeclared), false, `Ruta duplicada: ${canonicalDeclared}`);
  seenCanonical.add(canonicalDeclared);
}

assert.equal(manifest.coverage?.official_fixture_routes_observed, manifest.routes.length);
assert.equal(manifest.coverage?.routes_with_explicit_public_femebal_link, manifest.routes.length);
assert.equal(manifest.coverage?.routes_automatically_probed, 0);
assert.equal(manifest.coverage?.match_rows_discovered_from_routes, 0);
assert.equal(manifest.coverage?.match_sheets_discovered_from_routes, 0);
assert.equal(manifest.coverage?.parsed_match_sheets, 0);

console.log(`TournamentTracker evidence manifest SAFE: ${manifest.routes.length} rutas, 0 probes automáticos`);
