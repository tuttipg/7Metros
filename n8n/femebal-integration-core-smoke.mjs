import assert from 'node:assert/strict';
import { integratePlanillaWithOfficialIdsDryRun } from './femebal-integration-core.mjs';

const players = [
  [1,'Juan Martin','Bartolomeo',0,0,0,0,0],
  [2,'Martin','Farina',1,0,0,0,0],
  [3,'Ignacio','Goni',0,0,0,0,0],
  [4,'Santiago','Duhau',1,0,0,0,0],
  [5,'Atilio','Cocco',0,0,1,0,0],
  [6,'Federico Agustin','Pallero',2,0,0,0,0],
  [8,'Valentin','Schankula',6,0,1,0,0],
  [9,'Mariano','Bustamante',1,0,0,0,0],
  [10,'Juan Francisco','Ceccardi',4,0,0,0,0],
  [11,'Julian','Santos',1,0,0,0,0],
  [12,'Fausto','Vazquez Palmieri',0,0,0,0,0],
  [14,'Ivan Luca','Umansky Gavi',0,0,0,0,0],
  [17,'Agustin','Unzner',8,0,0,0,0],
  [19,'Matias','Jacquemin',0,0,0,0,0],
  [21,'Emiliano','Rubio',2,0,0,0,0],
  [22,'Juan Pablo','Aguero',1,0,0,0,0],
].map(([dorsal,nombre,apellido,goles,tarjeta_amarilla,exclusiones_2min,tarjeta_roja,tarjeta_azul]) => ({
  dorsal,nombre,apellido,goles,tarjeta_amarilla,exclusiones_2min,tarjeta_roja,tarjeta_azul,
}));

const parsed = {
  fecha:'2026-03-21',
  hora:'20:15:00',
  categoria:'Mayores',
  division:'LHC Hipotecario Seguros',
  local:{nombre:'Argentinos Juniors',goles:20},
  visitante:{nombre:'Ferro Carril Oeste',goles:27},
  jugadores_local:[
    {dorsal:1,nombre:'Synthetic',apellido:'Local',goles:20,tarjeta_amarilla:0,exclusiones_2min:0,tarjeta_roja:0,tarjeta_azul:0},
  ],
  jugadores_visitante:players,
};

const roster = Array.from({length:16},(_,i) => String(1001 + i));
const mappings = players.map((player,index) => ({
  dorsal: player.dorsal,
  athleteId: roster[index],
  provenance: 'explicit_external_id_mapping',
}));

const base = {
  parsed,
  context:{
    clubId:335,
    teamId:1843,
    tournamentId:775,
    matchId:null,
    matchSheetId:null,
    side:'visitante',
    expectedTeamName:'Ferro Carril Oeste',
  },
  rosterAthleteIds:roster,
  participantMappings:mappings,
};

const pending = integratePlanillaWithOfficialIdsDryRun(base);
assert.equal(pending.status,'pending_match_id');
assert.equal(pending.dry_run,true);
assert.equal(pending.write_enabled,false);
assert.equal(pending.identity_policy.name_join_used,false);
assert.equal(pending.resolved_participants.length,16);
assert.equal(pending.canonical_participations.length,0);
assert.equal(pending.summary.goles,27);
assert.equal(pending.summary.exclusiones_2min,2);
assert.equal(pending.roster_not_observed.length,0);

const ready = integratePlanillaWithOfficialIdsDryRun({
  ...base,
  context:{...base.context,matchId:9001,matchSheetId:7001},
});
assert.equal(ready.status,'canonical_match_ready');
assert.equal(ready.context.matchId,'9001');
assert.equal(ready.context.matchSheetId,'7001');
assert.equal(ready.canonical_participations.length,16);
assert.deepEqual(new Set(ready.canonical_participations.map((row) => row.matchId)),new Set(['9001']));
assert.deepEqual(new Set(ready.canonical_participations.map((row) => row.teamId)),new Set(['1843']));
assert.deepEqual(new Set(ready.canonical_participations.map((row) => row.tournamentId)),new Set(['775']));

assert.throws(
  () => integratePlanillaWithOfficialIdsDryRun({
    ...base,
    participantMappings:[...mappings.slice(0,15),{...mappings[15],athleteId:'9999'}],
  }),
  /fuera del roster/,
);
assert.throws(
  () => integratePlanillaWithOfficialIdsDryRun({...base,participantMappings:mappings.slice(0,15)}),
  /Mapping incompleto/,
);
assert.throws(
  () => integratePlanillaWithOfficialIdsDryRun({
    ...base,
    participantMappings:[...mappings.slice(0,15),{...mappings[15],athleteId:mappings[0].athleteId}],
  }),
  /athleteId duplicado/,
);
assert.throws(
  () => integratePlanillaWithOfficialIdsDryRun({...base,context:{...base.context,expectedTeamName:'Otro Club'}}),
  /Nombre de equipo inesperado/,
);
assert.throws(
  () => integratePlanillaWithOfficialIdsDryRun({...base,context:{...base.context,matchId:'abc'}}),
  /matchId inválido/,
);

console.log('✓ femebal-integration-core: IDs oficiales, roster, planilla y stats integrados fail-closed; sin joins por nombre ni escrituras');
