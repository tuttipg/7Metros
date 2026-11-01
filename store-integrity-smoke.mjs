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
  seasonId: 3,
  defaults: { categoria:'Mayores', division:'LHC Hipotecario Seguros', rama:'M' }
};

const store = await import('./store.js');

store.prepareDataset({
  globalSummary: { clubs:2, players:3, matches:3, finished:2, goals:108, avgGoals:54 },
  clubes: [
    {id:1,nombre:'Ferro Carril Oeste',abreviatura:'FCO'},
    {id:2,nombre:'S.A.G. Villa Ballester',abreviatura:'SAGVB'}
  ],
  equipos: [
    {id:101,club_id:1,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'A'},
    {id:102,club_id:2,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'A'},
    {id:103,club_id:1,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'B'},
    {id:104,club_id:999,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'A'},
    {id:105,club_id:1,temporada_id:4,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'A'},
    {id:106,club_id:null,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'A'},
    {id:'no-numérico',club_id:1,temporada_id:3,categoria:'Mayores',division:'LHC Hipotecario Seguros',rama:'M',equipo_codigo:'A'}
  ],
  jugadores: [
    {id:11,nombre:'Juan',apellido:'Pérez'},
    {id:12,nombre:'Mateo',apellido:'López'},
    {id:13,nombre:'Tomás',apellido:'B'}
  ],
  planteles: [
    {id:1,jugador_id:11,equipo_id:101,dorsal:7,posicion:'Lateral'},
    {id:2,jugador_id:12,equipo_id:102,dorsal:9,posicion:'Central'},
    {id:3,jugador_id:13,equipo_id:103,dorsal:10,posicion:'Extremo'},
    {id:4,jugador_id:11,equipo_id:103,dorsal:17,posicion:'Lateral'},
    {id:90,jugador_id:999,equipo_id:101,dorsal:90},
    {id:91,jugador_id:11,equipo_id:999,dorsal:91},
    {id:92,jugador_id:11,equipo_id:104,dorsal:92}
  ],
  partidos: [
    {id:201,fecha:'2026-09-01',hora:'20:00:00',local_equipo_id:101,visitante_equipo_id:102,estado:'finalizado',goles_local:30,goles_visitante:28},
    {id:202,fecha:'2026-09-08',hora:'20:00:00',local_equipo_id:102,visitante_equipo_id:101,estado:'programado',goles_local:null,goles_visitante:null},
    {id:203,fecha:'2026-09-03',hora:'20:00:00',local_equipo_id:102,visitante_equipo_id:103,estado:'finalizado',goles_local:24,goles_visitante:26},
    {id:204,fecha:'2026-09-10',local_equipo_id:101,visitante_equipo_id:999,estado:'finalizado',goles_local:31,goles_visitante:20},
    {id:205,fecha:'2026-09-11',local_equipo_id:999,visitante_equipo_id:102,estado:'finalizado',goles_local:20,goles_visitante:31},
    {id:206,fecha:'2026-09-12',local_equipo_id:998,visitante_equipo_id:999,estado:'finalizado',goles_local:22,goles_visitante:21},
    {id:207,fecha:'2026-09-13',local_equipo_id:104,visitante_equipo_id:101,estado:'finalizado',goles_local:22,goles_visitante:21}
  ],
  participaciones: [
    {id:1,partido_id:201,jugador_id:11,equipo_id:101,goles:10},
    {id:2,partido_id:201,jugador_id:12,equipo_id:102,goles:8},
    {id:3,partido_id:203,jugador_id:13,equipo_id:103,goles:6},
    {id:4,partido_id:203,jugador_id:11,equipo_id:103,goles:4},
    {id:5,partido_id:201,jugador_id:11,equipo_id:null,goles:99},
    {id:6,partido_id:null,jugador_id:11,equipo_id:101,goles:99},
    {id:7,partido_id:201,jugador_id:null,equipo_id:101,goles:99},
    {id:8,partido_id:201,jugador_id:11,equipo_id:999,goles:99},
    {id:9,partido_id:999,jugador_id:11,equipo_id:101,goles:99},
    {id:10,partido_id:201,jugador_id:11,equipo_id:103,goles:99},
    {id:11,partido_id:204,jugador_id:11,equipo_id:101,goles:99},
    {id:12,partido_id:207,jugador_id:11,equipo_id:101,goles:99}
  ]
});

assert.deepEqual(store.state.teams.map(row => row.id).sort((a,b)=>a-b), [101,102,103], 'equipos con club inexistente, temporada ajena o ID inválido deben descartarse en store');
assert.deepEqual(store.state.rosters.map(row => row.id).sort((a,b)=>a-b), [1,2,3,4], 'planteles con refs externas o equipos ya descartados deben descartarse');
assert.deepEqual(store.state.matches.map(row => row.id).sort((a,b)=>a-b), [201,202,203], 'partidos parciales, externos o ligados a equipo descartado deben fallar cerrados');
assert.deepEqual(store.state.participations.map(row => row.id).sort((a,b)=>a-b), [1,2,3,4], 'participaciones huérfanas, externas, sin refs o con equipo ajeno al partido deben descartarse');
assert.equal(store.state.index.rosterByPlayer.has(999), false);
assert.equal(store.state.index.rosterByTeam.has(999), false);
assert.equal(store.state.index.participationsByPlayer.has(0), false);
assert.equal(store.state.index.participationsByMatch.has(999), false);

const juanFerroA = store.getPlayersForTeamIds(new Set([101])).find(player => player.id === 11);
assert.equal(juanFerroA.goals, 10, 'participaciones inválidas no deben contaminar goles');
assert.equal(juanFerroA.matchesPlayed, 1, 'participaciones inválidas no deben contaminar partidos jugados');

console.log('Store integrity smoke test: OK');
