import assert from 'node:assert/strict';
import { resolveScopedRouteContext } from './scoped-route-core.mjs';

const oneContext = [
  { teamId: 10, contextKey: 'Mayores|LHC|M' },
  { teamId: 11, contextKey: 'Mayores|LHC|M' }
];

assert.deepEqual(
  resolveScopedRouteContext({ entityId: 7, currentPresent: true, memberships: oneContext }),
  { status: 'current', entityId: 7 }
);

assert.deepEqual(
  resolveScopedRouteContext({ entityId: 7, currentPresent: false, memberships: oneContext }),
  { status: 'team', entityId: 7, teamId: 10, contextKey: 'Mayores|LHC|M' }
);

assert.deepEqual(
  resolveScopedRouteContext({ entityId: 7, requestedTeamId: 11, currentPresent: true, memberships: oneContext }),
  { status: 'team', entityId: 7, teamId: 11, contextKey: 'Mayores|LHC|M' }
);

assert.equal(
  resolveScopedRouteContext({ entityId: 7, requestedTeamId: 99, currentPresent: true, memberships: oneContext }).status,
  'invalid-team'
);

const multiContext = [
  { teamId: 20, contextKey: 'Mayores|LHC|M' },
  { teamId: 21, contextKey: 'Cadetes|A|M' }
];
assert.equal(
  resolveScopedRouteContext({ entityId: 7, currentPresent: false, memberships: multiContext }).status,
  'ambiguous'
);

assert.equal(resolveScopedRouteContext({ entityId: 0, memberships: oneContext }).status, 'invalid');
assert.equal(resolveScopedRouteContext({ entityId: 7, memberships: [] }).status, 'missing');


// Regresión de renderizado real, con dataset local y sin peticiones de red.
// Antes, las fichas usaban getX(id) || getXs()[0] y mostraban otro registro
// cuando el ID del enlace era inexistente o estaba ausente.
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null };
globalThis.SEVEN_METROS_CONFIG = {
  seasonId: 3,
  defaults: { categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' }
};

const { state, prepareDataset } = await import('./store.js');
const { renderCurrentPage } = await import('./pages.js');

prepareDataset({
  clubes: [
    { id: 1, nombre: 'Club Uno' },
    { id: 2, nombre: 'Club Dos' }
  ],
  equipos: [
    { id: 11, club_id: 1, temporada_id: 3, categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' },
    { id: 12, club_id: 2, temporada_id: 3, categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' }
  ],
  jugadores: [{ id: 21, nombre: 'Prueba', apellido: 'Jugador' }],
  planteles: [{ id: 31, jugador_id: 21, equipo_id: 11, dorsal: 7, posicion: 'Central' }],
  partidos: [{ id: 41, local_equipo_id: 11, visitante_equipo_id: 12, fecha: '2026-10-29', estado: 'programado' }],
  participaciones: []
});
state.loaded = true;
state.filters = { categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M' };

const roots = new Map([
  ['club-detail', { innerHTML: '' }],
  ['player-detail', { innerHTML: '' }],
  ['match-detail', { innerHTML: '' }]
]);
globalThis.document = {
  body: { dataset: { page: 'clubes' } },
  getElementById: id => roots.get(id) || null,
  querySelector: () => null,
  title: '7Metros'
};
globalThis.location = { search: '' };

for (const { page, rootId, id, expectedName, missingTitle } of [
  { page: 'clubes', rootId: 'club-detail', id: 1, expectedName: 'Club Uno', missingTitle: 'Club no disponible' },
  { page: 'jugadores', rootId: 'player-detail', id: 21, expectedName: 'Prueba Jugador', missingTitle: 'Jugador no disponible' },
  { page: 'partidos', rootId: 'match-detail', id: 41, expectedName: 'Club Uno', missingTitle: 'Partido no disponible' }
]) {
  document.body.dataset.page = page;
  const root = roots.get(rootId);

  // Un enlace válido sigue mostrando su ficha correspondiente.
  location.search = `?id=${id}`;
  renderCurrentPage();
  assert.ok(root.innerHTML.includes(expectedName), `${page}: el ID válido debe renderizar su ficha`);

  // También después de renderizar una ficha válida, un ID incorrecto no debe
  // dejar el contenido previo ni sustituirlo por el primer registro.
  // Number() aceptaría "01", "1e0", "1.0" y parámetros duplicados como
  // si fueran el ID válido: todos deben terminar en estado no encontrado.
  const invalidQueries = [
    '?id=999', '?id=abc', '?id=0', '?id=-1',
    `?id=${String(id).padStart(3, '0')}`,
    `?id=${id}e0`, `?id=${id}.0`,
    `?id=${id}&id=${id}`,
    '?id=9007199254740992', ''
  ];
  for (const query of invalidQueries) {
    location.search = query;
    renderCurrentPage();
    assert.ok(root.innerHTML.includes(missingTitle), `${page}: ${query || '(sin ID)'} debe mostrar estado vacío`);
    assert.ok(!root.innerHTML.includes(expectedName), `${page}: ${query || '(sin ID)'} no debe mostrar otra ficha`);
  }

  // Los parámetros ajenos al ID no invalidan un enlace canónico.
  location.search = `?id=${id}&origen=inicio`;
  renderCurrentPage();
  assert.ok(root.innerHTML.includes(expectedName), `${page}: enlace válido con otros parámetros`);
}

console.log('scoped-route-smoke: ok — fichas válidas y IDs no canónicos/duplicados sin fallback');
