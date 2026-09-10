import assert from 'node:assert/strict';
import { parseOfficialFemebalSheet } from './planilla-core.mjs';

const fixture = `Torneo Metropolitano Apertura
Fecha:
2026-03-21
Hora:
20:15:00
Categoria - Division:
Mayores - LHC Hipotecario Seguros
Equipo local
Argentinos Juniors 20
Equipo visitante
Ferro Carril Oeste 27
Nº Local G TAm 2 TR TAz
1 Perznianko, Alan Nahuel - - - - -
2 Berardinelli, Mauro 2 - - - -
4 Sportelli Blejman, Lucas 2 - - - -
5 Gullo, Santino - - - - -
7 Dujaut, Ian 5 - 1 - -
8 Ghiotto, Matias - - - - -
9 Pereyra Oyarzun, Tobias - - - 1 -
10 Labartete, Ramiro - - - - -
11 Kelly, Steven 1 - - - -
13 Vazquez, Antonio 5 - - - -
14 Vienni, Enzo 1 - - - -
16 Trabella Ponce, Luciano - - - - -
17 Gimenez, Mateo 1 - 1 - -
18 Lugaro, Lautaro Nicolas - - - - -
33 Ochnio, Agustin 2 - - - -
37 Ingram Pautazzo, Eric Jhon 1 - - - -
A Capurro, Fernando Luis - - - -
Nº Visitante G TAm 2 TR TAz
1 Bartolomeo, Juan Martin - - - - -
2 Farina, Martin 1 - - - -
3 Goni, Ignacio - - - - -
4 Duhau, Santiago 1 - - - -
5 Cocco, Atilio - - 1 - -
6 Pallero, Federico Agustin 2 - - - -
8 Schankula, Valentin 6 - 1 - -
9 Bustamante, Mariano 1 - - - -
10 Ceccardi, Juan Francisco 4 - - - -
11 Santos, Julian 1 - - - -
12 Vazquez Palmieri, Fausto - - - - -
14 Umansky Gavi, Ivan Luca - - - - -
17 Unzner, Agustin 8 - - - -
19 Jacquemin, Matias - - - - -
21 Rubio, Emiliano 2 - - - -
22 Aguero, Juan Pablo 1 - - - -
A Fernandez Somoza, Rodrigo - - - -
Arbitros`;

const parsed = parseOfficialFemebalSheet(fixture);
assert.equal(parsed.fecha, '2026-03-21');
assert.equal(parsed.hora, '20:15:00');
assert.equal(parsed.categoria, 'Mayores');
assert.equal(parsed.division, 'LHC Hipotecario Seguros');
assert.equal(parsed.local.nombre, 'Argentinos Juniors');
assert.equal(parsed.visitante.nombre, 'Ferro Carril Oeste');
assert.equal(parsed.jugadores_local.length, 16);
assert.equal(parsed.jugadores_visitante.length, 16);
assert.equal(parsed.resumen.jugadores, 32);
assert.equal(parsed.resumen.goles, 47);
assert.equal(parsed.resumen.exclusiones_2min, 4);
assert.equal(parsed.resumen.rojas, 1);
assert.equal(parsed.resumen.amarillas, 0);
assert.equal(parsed.resumen.azules, 0);
assert.equal(parsed.jugadores_visitante.find((p) => p.apellido === 'Rubio').goles, 2);
assert.equal(parsed.jugadores_visitante.find((p) => p.apellido === 'Aguero').goles, 1);

assert.throws(
  () => parseOfficialFemebalSheet(fixture.replace('Ferro Carril Oeste 27', 'Ferro Carril Oeste 26')),
  /no cierran/,
);

console.log('✓ planilla-core: jugadores, goles y sanciones cierran con la planilla oficial');
