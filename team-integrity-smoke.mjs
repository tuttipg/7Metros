import assert from 'node:assert/strict';

class MemoryStorage {
  getItem(){ return null; }
  setItem(){}
  removeItem(){}
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

const requestedUrls = [];
const rowsByTable = {
  equipos: [
    {id:101,club_id:1,temporada_id:3,categoria:'Mayores',division:'LHC',rama:'M'},
    {id:102,club_id:999,temporada_id:3,categoria:'Mayores',division:'LHC',rama:'M'},
    {id:103,club_id:1,temporada_id:4,categoria:'Mayores',division:'LHC',rama:'M'},
    {id:'bad',club_id:1,temporada_id:3,categoria:'Mayores',division:'LHC',rama:'M'},
    {id:104,club_id:'bad',temporada_id:3,categoria:'Mayores',division:'LHC',rama:'M'}
  ],
  clubes: [{id:1,nombre:'Ferro Carril Oeste'}],
  planteles: [{id:1,jugador_id:11,equipo_id:101,dorsal:7,posicion:'Lateral'}],
  jugadores: [{id:11,nombre:'Juan',apellido:'Pérez'}],
  partidos: [],
  participaciones: [],
  v_global_summary: [{clubes:1,jugadores:1,partidos:0,partidos_con_resultado:0,goles:0,promedio_goles:null}]
};

globalThis.fetch = async function(url){
  const text = String(url);
  requestedUrls.push(text);
  const table = text.split('/rest/v1/')[1].split('?')[0];
  const rows = rowsByTable[table] || [];
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: {
      'Content-Type':'application/json',
      'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`
    }
  });
};

const api = await import('./api.js');
const dataset = await api.loadPublicDataset(3);

assert.deepEqual(dataset.equipos.map(row => row.id), [101], 'Sólo debe sobrevivir el equipo de la temporada solicitada cuyo club existe');
assert.deepEqual(dataset.clubes.map(row => row.id), [1]);
assert.deepEqual(dataset.planteles.map(row => row.equipo_id), [101]);

const rosterRequest = requestedUrls.find(url => url.includes('/rest/v1/planteles?')) || '';
const participationRequest = requestedUrls.find(url => url.includes('/rest/v1/participaciones?')) || '';
assert.match(rosterRequest, /equipo_id=in\.\(101\)/, 'Planteles sólo deben pedirse para equipos válidos');
assert.doesNotMatch(rosterRequest, /102|103|104|999/, 'Equipos rechazados no deben propagarse a planteles');
assert.match(participationRequest, /equipo_id=in\.\(101\)/, 'Participaciones sólo deben pedirse para equipos válidos');
assert.doesNotMatch(participationRequest, /102|103|104|999/, 'Equipos rechazados no deben propagarse a participaciones');

console.log('✓ team-integrity-smoke: temporada, IDs y club de equipos se validan fail-closed antes de relaciones dependientes');
