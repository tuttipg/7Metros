import assert from 'node:assert/strict';
import { validateTournamentTrackerFixtureOffline } from './tournamenttracker-fixture-validator-core.mjs';

function check(name, fn) {
  process.stdout.write(`→ ${name}\n`);
  fn();
  process.stdout.write(`✓ ${name}\n`);
}

const pdf='https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const expected={fecha:'2026-03-21',local:'Argentinos Juniors',visitante:'Ferro Carril Oeste',goles_local:20,goles_visitante:27};
const control={fecha:'2026-03-21',local:'Argentinos Juniors',visitante:'Ferro Carril Oeste',goles_local:20,goles_visitante:27,planillas:[{pdf}]};
const fixture={source:'tournamenttracker_offline_fixture',network_used:false,auth_used:false,write_enabled:false,partidos:[control]};

check('control Argentinos Juniors 20–27 Ferro 2026-03-21', () => {
  const result=validateTournamentTrackerFixtureOffline({fixture,expected});
  assert.equal(result.dry_run,true);
  assert.equal(result.network_used,false);
  assert.equal(result.auth_used,false);
  assert.equal(result.write_enabled,false);
  assert.equal(result.expected_match_checked,true);
  assert.equal(result.pdf_url,pdf);
  assert.equal(result.match.goles_local,20);
  assert.equal(result.match.goles_visitante,27);
});

check('normalización de identidad', () => {
  const accent=validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,local:'Argentínos   Juniors',visitante:'FERRO CARRIL OESTE'}]},expected});
  assert.equal(accent.pdf_url,pdf);
});

check('network fail-closed', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,network_used:true},expected}),/network_used=false/));
check('auth fail-closed', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,auth_used:true},expected}),/autenticación/));
check('write fail-closed', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,write_enabled:true},expected}),/escritura/));
check('marcador exacto requerido', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture,expected:{...expected,goles_visitante:26}}),/No existe coincidencia exacta/));
check('coincidencia ambigua rechazada', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[control,control]},expected}),/ambigua/));
check('planilla ausente rechazada', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,planillas:[]}]},expected}),/no tiene planilla/));
check('múltiples planillas rechazadas', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,planillas:[{pdf},{pdf}]}]},expected}),/múltiples planillas/));
check('host PDF externo rechazado', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,planillas:[{pdf:'https://evil.example/x.pdf'}]}]},expected})));
check('PDF no explícito rechazado', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture:{...fixture,partidos:[{...control,planillas:[{}]}]},expected}),/sin pdf explícito/));
check('fecha esperada vacía rechazada', () => assert.throws(()=>validateTournamentTrackerFixtureOffline({fixture,expected:{...expected,fecha:''}}),/Fecha esperada inválida/));

console.log('✓ TournamentTracker fixture offline: regresión SAFE completa validada');
