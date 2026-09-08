import assert from 'node:assert/strict';

class MemoryStorage {
  constructor(){ this.data = new Map(); }
  getItem(k){ return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k,v){ this.data.set(k,String(v)); }
  removeItem(k){ this.data.delete(k); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = globalThis;
window.SEVEN_METROS_CONFIG = {
  supabaseUrl: 'https://mock.7metros.test',
  supabaseKey: 'test',
  seasonId: 3,
  seasonLabel: 'CLAUSURA 2026',
  timezone: 'America/Argentina/Buenos_Aires',
  locale: 'es-AR',
  defaults: { categoria:'Mayores', division:'LHC Hipotecario Seguros', rama:'M' }
};

const db = {
  equipos: [
    {id:101,club_id:1,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',activo:true},
    {id:102,club_id:2,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',activo:true}
  ],
  clubes: [{id:1,nombre:'Ferro Carril Oeste'},{id:2,nombre:'S.A.G. Villa Ballester'}],
  jugadores: [
    {id:11,nombre:'Juan',apellido:'Pérez',fecha_nacimiento:'2002-01-01',brazo_habil:'Derecho',altura_cm:188,peso_kg:84},
    {id:12,nombre:'Mateo',apellido:'López',fecha_nacimiento:'2001-01-01',brazo_habil:'Izquierdo',altura_cm:184,peso_kg:80}
  ],
  planteles: [
    {id:1,jugador_id:11,equipo_id:101,dorsal:7,posicion:'Lateral'},
    {id:2,jugador_id:12,equipo_id:102,dorsal:9,posicion:'Central'}
  ],
  partidos: [
    {id:201,fecha:'2026-09-01',hora:'20:00:00',jornada:1,local_equipo_id:101,visitante_equipo_id:102,estado:'finalizado',goles_local:30,goles_visitante:28},
    {id:202,fecha:'2026-09-08',hora:'20:00:00',jornada:2,local_equipo_id:102,visitante_equipo_id:101,estado:'programado',goles_local:null,goles_visitante:null}
  ],
  participaciones: [
    {id:1,partido_id:201,jugador_id:11,equipo_id:101,goles:10,exclusiones_2min:1,tarjeta_amarilla:0,tarjeta_roja:0},
    {id:2,partido_id:201,jugador_id:12,equipo_id:102,goles:8,exclusiones_2min:0,tarjeta_amarilla:1,tarjeta_roja:0}
  ]
};

globalThis.fetch = async function(url){
  const table = String(url).split('/rest/v1/')[1].split('?')[0];
  return new Response(JSON.stringify(db[table] || []), { status:200, headers:{'Content-Type':'application/json'} });
};

const store = await import('../js/store.js');
await store.loadData();

assert.equal(store.state.loaded, true);
assert.equal(store.getClubs().length, 2);
assert.equal(store.getPlayers().length, 2);
assert.equal(store.getMatches().length, 2);
assert.equal(store.dataSummary().finished, 1);
assert.equal(store.dataSummary().goals, 58);

const juan = store.getPlayer(11);
assert.equal(juan.goals, 10);
assert.equal(juan.matchesPlayed, 1);
assert.equal(juan.goalsPerMatch, 10);
assert.equal(juan.assists, null, 'Métricas ausentes no deben inventarse como 0');

const table = store.getStandings();
assert.equal(table[0].name, 'Ferro Carril Oeste');
assert.equal(table[0].points, 2);
assert.equal(table[0].gd, 2);
assert.equal(table[1].points, 0);

console.log('✓ store-smoke: carga, filtros, estadísticas y posiciones OK');
