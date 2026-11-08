import assert from 'node:assert/strict';
import { EXACT_PLAYER_SCOPE_FIELDS, resolveEquipoExact, resolveJugadoresExact } from './player-scope-core.mjs';

assert.deepEqual(EXACT_PLAYER_SCOPE_FIELDS, ['club_id', 'temporada_id', 'categoria', 'division', 'rama']);

const equipos = [
  { id: 101, club_id: 1, temporada_id: 2026, categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M', equipo_codigo: 'A', nombre_femebal: 'Ferro Carril Oeste A' },
  { id: 102, club_id: 1, temporada_id: 2026, categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'M', equipo_codigo: 'B', nombre_femebal: 'Ferro Carril Oeste B' },
  { id: 201, club_id: 1, temporada_id: 2026, categoria: 'Junior', division: 'A', rama: 'M', equipo_codigo: 'A', nombre_femebal: 'Ferro Carril Oeste A' },
];

const planteles = [
  { id: 1, jugador_id: 11, equipo_id: 101, dorsal: 8, posicion: 'Lateral' },
  { id: 2, jugador_id: 12, equipo_id: 101, dorsal: 17, posicion: 'Central' },
  { id: 3, jugador_id: 13, equipo_id: 102, dorsal: 7, posicion: 'Extremo' },
  { id: 4, jugador_id: 11, equipo_id: 201, dorsal: 18, posicion: 'Lateral' },
];

const jugadores = [
  { id: 11, nombre: 'Valentín', apellido: 'Ejemplo' },
  { id: 12, nombre: 'Agustín', apellido: 'Ejemplo' },
  { id: 13, nombre: 'Tomás', apellido: 'Ejemplo' },
];

const baseScope = {
  club_id: 1,
  temporada_id: 2026,
  categoria: 'Mayores',
  division: 'LHC Hipotecario Seguros',
  rama: 'M',
};

// Scope válido: decimal canónico como número o string.
assert.equal(resolveEquipoExact(equipos, baseScope).state, 'scope_ambiguo');
assert.equal(resolveEquipoExact(equipos, { ...baseScope, club_id: '1', temporada_id: '2026' }).state, 'scope_ambiguo');

// IDs del selector coercibles pero ambiguos/malformados deben fallar cerrado.
for (const bad of ['01', '1.0', '1e1', '+1', ' 1', '1 ', true, false, 1.5, 0, -1, Infinity, '9007199254740992', {}, []]) {
  assert.throws(() => resolveEquipoExact(equipos, { ...baseScope, club_id: bad }), /club_id debe ser un entero positivo/);
  assert.throws(() => resolveEquipoExact(equipos, { ...baseScope, temporada_id: bad }), /temporada_id debe ser un entero positivo/);
}

// Datos internos también deben usar IDs decimales canónicos: Number("01") no debe igualar 1.
const malformedInternalIds = [
  { ...equipos[0], club_id: '01' },
  { ...equipos[0], temporada_id: '2026.0' },
  { ...equipos[0], id: '0101' },
];
for (const malformed of malformedInternalIds) {
  assert.equal(
    resolveEquipoExact([malformed], { ...baseScope, equipo_codigo: 'A' }).state,
    malformed.id === '0101' ? 'integrity_error' : 'equipo_no_resuelto',
  );
}

const resolved = resolveJugadoresExact(
  { equipos, planteles, jugadores },
  { ...baseScope, equipo_codigo: 'A' },
);
assert.equal(resolved.state, 'resolved');
assert.equal(resolved.equipo.id, 101);
assert.deepEqual(resolved.jugadores.map((row) => row.jugador_id), [11, 12]);
assert.ok(resolved.jugadores.every((row) => row.equipo_id === 101));
assert.ok(!resolved.jugadores.some((row) => row.jugador_id === 13));

const stringInternalIds = resolveJugadoresExact(
  {
    equipos: equipos.map((row) => ({ ...row, id: String(row.id), club_id: String(row.club_id), temporada_id: String(row.temporada_id) })),
    planteles: planteles.map((row) => ({ ...row, equipo_id: String(row.equipo_id), jugador_id: String(row.jugador_id) })),
    jugadores: jugadores.map((row) => ({ ...row, id: String(row.id) })),
  },
  { ...baseScope, equipo_codigo: 'A' },
);
assert.equal(stringInternalIds.state, 'resolved');
assert.deepEqual(stringInternalIds.jugadores.map((row) => row.jugador_id), [11, 12]);

const malformedRosterId = resolveJugadoresExact(
  {
    equipos,
    planteles: [...planteles.filter((row) => row.equipo_id === 101), { id: 99, jugador_id: '01', equipo_id: 101 }],
    jugadores,
  },
  { ...baseScope, equipo_codigo: 'A' },
);
assert.equal(malformedRosterId.state, 'integrity_error');
assert.deepEqual(malformedRosterId.missing_player_ids, [null]);

const junior = resolveJugadoresExact(
  { equipos, planteles, jugadores },
  { club_id: 1, temporada_id: 2026, categoria: 'Junior', division: 'A', rama: 'M' },
);
assert.equal(junior.state, 'resolved');
assert.deepEqual(junior.jugadores.map((row) => row.jugador_id), [11]);
assert.equal(junior.jugadores[0].dorsal, 18);

const notFound = resolveJugadoresExact(
  { equipos, planteles, jugadores },
  { club_id: 1, temporada_id: 2026, categoria: 'Mayores', division: 'LHC Hipotecario Seguros', rama: 'F' },
);
assert.equal(notFound.state, 'equipo_no_resuelto');
assert.deepEqual(notFound.jugadores, []);

const broken = resolveJugadoresExact(
  {
    equipos: [equipos[0]],
    planteles: [...planteles.filter((row) => row.equipo_id === 101), { id: 99, jugador_id: 999, equipo_id: 101 }],
    jugadores,
  },
  { ...baseScope, equipo_codigo: 'A' },
);
assert.equal(broken.state, 'integrity_error');
assert.deepEqual(broken.missing_player_ids, [999]);

console.log('✓ player-scope-core: scope exacto, IDs estrictos, normalización interna, ambigüedad fail-closed y join de plantel validados');
