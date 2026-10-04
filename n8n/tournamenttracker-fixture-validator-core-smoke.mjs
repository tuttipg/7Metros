import assert from 'node:assert/strict';
import { validateTournamentTrackerFixtureOffline } from './tournamenttracker-fixture-validator-core.mjs';

const pdf='https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const expected={fecha:'2026-03-21',local:'Argentinos Juniors',visitante:'Ferro Carril Oeste',goles_local:20,goles_visitante:27};
const control={fecha:'2026-03-21',local:'Argentinos Juniors',visitante:'Ferro Carril Oeste',goles_local:20,goles_visitante:27,planillas:[{pdf}]};
const fixture={source:'tournamenttracker_offline_fixture',network_used:false,auth_used:false,write_enabled:false,partidos:[control]};
const result=validateTournamentTrackerFixtureOffline({fixture,expected});
assert.equal(result.dry_run,true);
assert.equal(result.network_used,false);
assert.equal(result.auth_used,false);
assert.equal(result.write_enabled,false);
assert.equal(result.expected_match_checked,true);
assert.equal(result.pdf_url,pdf);
assert.equal(result.match.goles_local,20);
assert.equal(result.match.goles_visitante,27);

const accent=validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,local:'Argentínos   Juniors',visitante:'FERRO CARRIL OESTE'}]},expected});
assert.equal(accent.pdf_url,pdf);

assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,network_used:true},expected}),/network_used=false/);
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,auth_used:true},expected}),/autenticación/);
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,write_enabled:true},expected}),/escritura/);
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture,expected:{...expected,goles_visitante:26}}),/No existe coincidencia exacta/);
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[control,control]},expected}),/ambigua/);
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,planillas:[]}]},expected}),/no tiene planilla/);
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,planillas:[{pdf},{pdf}]}]},expected}),/múltiples planillas/);
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,planillas:[{pdf:'https://evil.example/x.pdf'}]}]},expected));
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,planillas:[{}]}]},expected}),/sin pdf explícito/);
assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture,expected:{...expected,fecha:''}}),/Fecha esperada inválida/);
console.log('✓ TournamentTracker fixture offline: control 20–27, ambigüedad, PDF explícito y SAFE fail-closed validados');
