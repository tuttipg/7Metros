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
  v_global_summary: [
    {clubes:2,jugadores:3,partidos:3,partidos_con_resultado:2,goles:108,promedio_goles:54}
  ],
  equipos: [
    {id:101,club_id:1,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'A',activo:true},
    {id:103,club_id:1,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'B',activo:true},
    {id:102,club_id:2,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'A',activo:true}
  ],
  clubes: [
    {id:1,nombre:'Ferro Carril Oeste',abreviatura:'FCO',ciudad:'CABA',logo_url:'https://example.test/ferro.png'},
    {id:2,nombre:'S.A.G. Villa Ballester',abreviatura:null,ciudad:null,logo_url:null}
  ],
  jugadores: [
    {id:11,nombre:'Juan',apellido:'Pérez',fecha_nacimiento:'2002-01-01',brazo_habil:'Derecho',altura_cm:188,peso_kg:84},
    {id:12,nombre:'Mateo',apellido:'López',fecha_nacimiento:'2001-01-01',brazo_habil:'Izquierdo',altura_cm:184,peso_kg:80},
    {id:13,nombre:'Tomás',apellido:'B',fecha_nacimiento:'2003-01-01',brazo_habil:'Derecho',altura_cm:181,peso_kg:78}
  ],
  planteles: [
    {id:1,jugador_id:11,equipo_id:101,dorsal:7,posicion:'Lateral'},
    {id:2,jugador_id:12,equipo_id:102,dorsal:9,posicion:'Central'},
    {id:3,jugador_id:13,equipo_id:103,dorsal:10,posicion:'Extremo'}
  ],
  partidos: [
    {id:201,fecha:'2026-09-01',hora:'20:00:00',jornada:1,local_equipo_id:101,visitante_equipo_id:102,estado:'finalizado',goles_local:30,goles_visitante:28},
    {id:203,fecha:'2026-09-03',hora:'20:00:00',jornada:1,local_equipo_id:102,visitante_equipo_id:103,estado:'finalizado',goles_local:24,goles_visitante:26},
    {id:202,fecha:'2026-09-08',hora:'20:00:00',jornada:2,local_equipo_id:102,visitante_equipo_id:101,estado:'programado',goles_local:null,goles_visitante:null}
  ],
  participaciones: [
    {id:1,partido_id:201,jugador_id:11,equipo_id:101,goles:10,exclusiones_2min:1,tarjeta_amarilla:0,tarjeta_roja:0},
    {id:2,partido_id:201,jugador_id:12,equipo_id:102,goles:8,exclusiones_2min:0,tarjeta_amarilla:1,tarjeta_roja:0},
    {id:3,partido_id:203,jugador_id:13,equipo_id:103,goles:6,exclusiones_2min:0,tarjeta_amarilla:0,tarjeta_roja:0}
  ]
};

globalThis.fetch = async function(url){
  const table = String(url).split('/rest/v1/')[1].split('?')[0];
  const rows = db[table] || [];
  return new Response(JSON.stringify(rows), {
    status:200,
    headers:{'Content-Type':'application/json', 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`}
  });
};

const api = await import('./api.js');
assert.deepEqual(api.validatePublicConfig(), { base:'https://mock.7metros.test', key:'test' });
assert.throws(
  () => api.validatePublicConfig({ supabaseUrl:'', supabaseKey:'test' }),
  error => error instanceof api.DataError && /URL pública/.test(error.message)
);
assert.throws(
  () => api.validatePublicConfig({ supabaseUrl:'http://example.com', supabaseKey:'test' }),
  error => error instanceof api.DataError && /HTTPS/.test(error.message)
);
assert.throws(
  () => api.validatePublicConfig({ supabaseUrl:'https://example.com', supabaseKey:'test' }),
  error => error instanceof api.DataError && /endpoint esperado/.test(error.message)
);
assert.throws(
  () => api.validatePublicConfig({ supabaseUrl:'https://mock.7metros.test', supabaseKey:'' }),
  error => error instanceof api.DataError && /clave pública/.test(error.message)
);
assert.rejects(
  () => api.loadPublicDataset(0),
  error => error instanceof api.DataError && /temporada configurada/.test(error.message)
);

const store = await import('./store.js');
await store.loadData();

assert.equal(store.state.loaded, true);
assert.equal(store.getClubs().length, 3, 'A y B deben ser filas deportivas separadas');
assert.equal(store.getPlayers().length, 3);
assert.equal(store.getMatches().length, 3);
assert.equal(store.dataSummary().finished, 2);
assert.equal(store.dataSummary().goals, 108);
assert.deepEqual(store.globalDataSummary(), {
  clubs: 2,
  players: 3,
  matches: 3,
  finished: 2,
  goals: 108,
  avgGoals: 54
});
assert.equal(store.getBaseClub(1).abbr, 'FCO');
assert.equal(store.getBaseClub(1).logoUrl, 'https://example.test/ferro.png');
assert.equal(store.getBaseClub(2).logoUrl, null);

const juan = store.getPlayer(11);
assert.equal(juan.goals, 10);
assert.equal(juan.matchesPlayed, 1);
assert.equal(juan.goalsPerMatch, 10);
assert.equal(juan.assists, null, 'Métricas ausentes no deben inventarse como 0');

const bTeam = store.getClubs().find(row => row.teamId === 103);
assert.equal(bTeam.name, 'Ferro Carril Oeste · Equipo B');
assert.equal(bTeam.teamCode, 'B');
assert.equal(bTeam.points, 2);
assert.equal(store.state.matches.find(row => row.id === 203).away, 'Ferro Carril Oeste · Equipo B');

const table = store.getStandings();
assert.equal(table[0].name, 'Ferro Carril Oeste');
assert.equal(table[0].points, 2);
assert.equal(table[0].gd, 2);
assert.equal(table[1].name, 'Ferro Carril Oeste · Equipo B');
assert.equal(table[1].points, 2);
assert.equal(table[2].points, 0);

console.log('✓ store-smoke: configuración, resumen global, carga, logos, equipos A/B, filtros, estadísticas y posiciones OK');
