/* 7Metros — comportamiento de la demo estática */
const ICONS={
 home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
 shield:'<path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-5"/>',
 user:'<circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
 clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
 chart:'<path d="M4 20V10M9 20V4M14 20v-7M19 20V7M2 20h20"/>',
 ball:'<circle cx="12" cy="12" r="9"/><path d="m12 7 3 2-1 4h-4L9 9l3-2ZM6 11l4 2M18 11l-4 2M9 18l1-5M15 18l-1-5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.6.7 1 .9.2.1.6.1.9.1H21v4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 file:'<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/>',
 video:'<rect x="3" y="6" width="14" height="12" rx="2"/><path d="m17 10 4-2v8l-4-2z"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m15 9 5-5M17 4h3v3"/>',
 trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
 run:'<circle cx="14" cy="5" r="2"/><path d="m12 8-3 4 4 2 2 5M9 12l-4 2M13 10l4 3 3-1"/>',
 card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h2"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
 download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', chevron:'<path d="m9 18 6-6-6-6"/>',
 goal:'<rect x="3" y="7" width="18" height="11" rx="1"/><path d="M3 11h18M7 7v11M12 7v11M17 7v11"/>'
};
function icon(name,cls=''){return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.info}</svg>`}

// ============================================================
// 7METROS — CONEXIÓN CON SUPABASE
// ============================================================

const SUPABASE_URL = 'https://bvnfgfwxnkusicipwlas.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xjIsk7dLam6gOKSG1FbwOQ_tResnm7U';

let baseClubs = [];
let baseTeams = [];
let basePlayers = [];
let baseMatches = [];
let baseParticipations = [];

const CURRENT_SEASON_ID = 3;

let competitionFilters = {
    categoria: localStorage.getItem('7m_categoria') || 'Mayores',
    division: localStorage.getItem('7m_division') || 'LHC Hipotecario Seguros',
    rama: localStorage.getItem('7m_rama') || 'M'
};

const SUPABASE_HEADERS = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
};

async function supabaseGet(table, query = '') {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}${query}`,
        {
            method: 'GET',
            headers: {
                ...SUPABASE_HEADERS,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase ${table}: ${error}`);
    }

    return response.json();
}


// ------------------------------------------------------------
// CARGAR TODOS LOS DATOS
// ------------------------------------------------------------

async function cargarDatosSupabase() {

    try {

        console.log('7Metros: conectando con Supabase...');

        const [
            clubesDB,
            equiposDB,
            jugadoresDB,
            plantelesDB,
            partidosDB,
            participacionesDB
        ] = await Promise.all([

            supabaseGet(
                'clubes',
                '?select=id,nombre'
            ),

            supabaseGet(
                'equipos',
                '?select=id,club_id,temporada_id,categoria,division,rama,equipo_codigo,nombre_femebal,activo'
            ),

            supabaseGet(
                'jugadores',
                '?select=id,nombre,apellido,fecha_nacimiento,brazo_habil,altura_cm,peso_kg'
            ),

            supabaseGet(
                'planteles',
                '?select=id,jugador_id,equipo_id,dorsal,posicion'
            ),

            supabaseGet(
                'partidos',
                '?select=*'
            ),

            supabaseGet(
                'participaciones',
                '?select=*'
            )
        ]);

        baseTeams = equiposDB.map(e => ({
            ...e,
            id: Number(e.id),
            club_id: Number(e.club_id),
            temporada_id: Number(e.temporada_id)
        }));

        const equiposActuales = baseTeams.filter(
            e => Number(e.temporada_id) === CURRENT_SEASON_ID
        );

        const equipoPorId = new Map(
            equiposDB.map(e => [Number(e.id), e])
        );

        const clubPorId = new Map(
            clubesDB.map(c => [Number(c.id), c])
        );

        // ----------------------------------------------------
        // CLUBES
        // ----------------------------------------------------

        baseClubs = clubesDB.map(c => ({
            id: Number(c.id),
            name: c.nombre,
            abbr: initials(c.nombre),
            city: '',
            color: ''
        }));


        // ----------------------------------------------------
        // JUGADORES
        // ----------------------------------------------------

        basePlayers = jugadoresDB.map(j => {

            const memberships = plantelesDB
                .filter(p => Number(p.jugador_id) === Number(j.id))
                .map(p => {
                    const equipo = equipoPorId.get(Number(p.equipo_id));
                    if (!equipo) return null;

                    return {
                        teamId: Number(equipo.id),
                        clubId: Number(equipo.club_id),
                        temporadaId: Number(equipo.temporada_id),
                        categoria: equipo.categoria,
                        division: equipo.division,
                        rama: equipo.rama,
                        number: p.dorsal ?? '-',
                        position: p.posicion || 'Sin posición'
                    };
                })
                .filter(Boolean);

            return {
                id: Number(j.id),
                name: `${j.nombre || ''} ${j.apellido || ''}`.trim(),
                memberships,
                fechaNacimiento: j.fecha_nacimiento,
                brazoHabil: j.brazo_habil,
                altura: j.altura_cm,
                peso: j.peso_kg
            };

        });


        // ----------------------------------------------------
        // PARTIDOS
        // ----------------------------------------------------

        baseMatches = partidosDB.map(p => {

            const homeTeam = equipoPorId.get(Number(p.local_equipo_id));
            const awayTeam = equipoPorId.get(Number(p.visitante_equipo_id));

            const homeClub = homeTeam
                ? clubPorId.get(Number(homeTeam.club_id))
                : null;

            const awayClub = awayTeam
                ? clubPorId.get(Number(awayTeam.club_id))
                : null;

            const finalizado =
                String(p.estado || '').toLowerCase() === 'finalizado';

            return {
                id: Number(p.id),
                date: p.fecha,
                round: p.jornada ? `Fecha ${p.jornada}` : 'Partido',

                homeId: homeClub ? Number(homeClub.id) : null,
                awayId: awayClub ? Number(awayClub.id) : null,

                homeTeamId: homeTeam ? Number(homeTeam.id) : null,
                awayTeamId: awayTeam ? Number(awayTeam.id) : null,

                home: homeClub?.nombre || homeTeam?.nombre_femebal || 'Local',
                away: awayClub?.nombre || awayTeam?.nombre_femebal || 'Visitante',

                homeScore: finalizado ? Number(p.goles_local || 0) : null,
                awayScore: finalizado ? Number(p.goles_visitante || 0) : null,

                status: finalizado ? 'Finalizado' : 'Programado',
                time: p.hora ? String(p.hora).slice(0, 5) : '',
                createdAt: p.created_at || null,
                notes: p.observaciones || '',

                seasonId: homeTeam ? Number(homeTeam.temporada_id) : Number(p.temporada_id),
                categoria: homeTeam?.categoria || '',
                division: homeTeam?.division || '',
                rama: homeTeam?.rama || ''
            };

        });

        baseParticipations = participacionesDB;

        console.log('7Metros: datos cargados correctamente');
        console.log('Clubes:', baseClubs.length);
        console.log('Equipos:', baseTeams.length);
        console.log('Jugadores:', basePlayers.length);
        console.log('Partidos:', baseMatches.length);
        console.log('Participaciones:', baseParticipations.length);

    } catch (error) {

        console.error('Error conectando con Supabase:', error);
        showToast('No se pudieron cargar los datos de 7Metros.');

    }

}


// ------------------------------------------------------------
// FUNCIONES DE ACCESO A LOS DATOS
// ------------------------------------------------------------

function filteredTeams() {
    return baseTeams.filter(e => {
        if (Number(e.temporada_id) !== CURRENT_SEASON_ID) return false;
        if (competitionFilters.categoria && e.categoria !== competitionFilters.categoria) return false;
        if (competitionFilters.division && e.division !== competitionFilters.division) return false;
        if (competitionFilters.rama && e.rama !== competitionFilters.rama) return false;
        return true;
    });
}

function filteredTeamIds() {
    return new Set(filteredTeams().map(e => Number(e.id)));
}

function players() {
    const allowedTeams = filteredTeamIds();

    return basePlayers
        .map(p => {
            const membership = p.memberships.find(m => allowedTeams.has(Number(m.teamId)));
            if (!membership) return null;

            const clubData = baseClubs.find(c => Number(c.id) === Number(membership.clubId));

            const participacionesJugador = baseParticipations.filter(part =>
                Number(part.jugador_id) === Number(p.id) &&
                allowedTeams.has(Number(part.equipo_id))
            );

            const goles = participacionesJugador.reduce(
                (total, part) => total + Number(part.goles || 0),
                0
            );

            const sanciones = participacionesJugador.reduce(
                (total, part) =>
                    total +
                    Number(part.exclusiones_2min || 0) +
                    Number(part.tarjeta_amarilla || 0) +
                    Number(part.tarjeta_roja || 0),
                0
            );

            return {
                ...p,
                clubId: Number(membership.clubId),
                club: clubData?.name || 'Sin club',
                teamId: Number(membership.teamId),
                number: membership.number,
                position: membership.position,
                goals: goles,
                assists: 0,
                eff: 0,
                sanctions: sanciones
            };
        })
        .filter(Boolean);
}

function matches() {
    const allowedTeams = filteredTeamIds();

    return baseMatches.filter(m =>
        Number(m.seasonId) === CURRENT_SEASON_ID &&
        allowedTeams.has(Number(m.homeTeamId)) &&
        allowedTeams.has(Number(m.awayTeamId))
    );
}

function clubs() {
    const visibleClubIds = new Set(
        filteredTeams().map(e => Number(e.club_id))
    );

    const ps = players();
    const ms = matches();

    return baseClubs
        .filter(c => visibleClubIds.has(Number(c.id)))
        .map(c => {
            const jugadoresClub = ps.filter(p => Number(p.clubId) === Number(c.id));

            const partidosClub = ms.filter(m =>
                Number(m.homeId) === Number(c.id) ||
                Number(m.awayId) === Number(c.id)
            );

            const finalizados = partidosClub.filter(
                m => m.status === 'Finalizado'
            );

            let puntos = 0;

            finalizados.forEach(m => {
                const esLocal = Number(m.homeId) === Number(c.id);
                const propios = esLocal ? Number(m.homeScore || 0) : Number(m.awayScore || 0);
                const rivales = esLocal ? Number(m.awayScore || 0) : Number(m.homeScore || 0);

                if (propios > rivales) puntos += 2;
                else if (propios === rivales) puntos += 1;
            });

            return {
                ...c,
                players: jugadoresClub.length,
                played: finalizados.length,
                points: puntos
            };
        });
}

function club(id) {
    return clubs().find(c => Number(c.id) === Number(id)) ||
        baseClubs.find(c => Number(c.id) === Number(id)) ||
        {
            id: id,
            abbr: '7M',
            name: '7Metros',
            color: ''
        };
}

function initials(name){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function badge(c,small=false){return `<span class="${small?'mini-badge':'club-badge'} ${c.color||''}">${esc(c.abbr)}</span>`}
function formatDateISO(s){const d=new Date(`${s}T12:00:00`);return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')}
function dateBox(s){const d=new Date(`${s}T12:00:00`);return `<span class="date-box">${String(d.getDate()).padStart(2,'0')}<small>${d.toLocaleDateString('es-AR',{month:'short'}).replace('.','').toUpperCase()}</small></span>`}
function currentDateLabel(){return new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}

function renderShell(){
 const page=document.body.dataset.page||'inicio';
 const nav=[['inicio','index.html','home','INICIO'],['clubes','clubes.html','shield','CLUBES'],['jugadores','jugadores.html','user','JUGADORES'],['planteles','planteles.html','users','PLANTELES'],['partidos','partidos.html','calendar','PARTIDOS'],['participaciones','participaciones.html','clipboard','PARTICIPACIONES'],['estadisticas','estadisticas.html','chart','ESTADÍSTICAS'],['reportes','reportes.html','download','REPORTES']];
 const secondary=[['ajustes','ajustes.html','settings','AJUSTES'],['acerca','acerca-de.html','info','ACERCA DE']];
 const links=nav.map(([id,href,ic,label])=>`<a class="nav-link ${page===id?'active':''}" href="${href}"><span class="nav-icon">${icon(ic)}</span><span>${label}</span></a>`).join('');
 const secondaryLinks=secondary.map(([id,href,ic,label])=>`<a class="nav-link ${page===id?'active':''}" href="${href}"><span class="nav-icon">${icon(ic)}</span><span>${label}</span></a>`).join('');
 const sidebar=document.getElementById('sidebar');
 if(sidebar) sidebar.innerHTML=`<div class="brand"><div class="brand-logo"><span class="seven">7</span><span class="m">M</span></div><span class="brand-name">7<b>METROS</b></span><span class="brand-sub">HANDBALL APP</span></div><nav class="nav">${links}<div class="nav-link disabled" title="Próximamente"><span class="nav-icon">${icon('ball')}</span><span>IA (PRÓXIMAMENTE)</span></div><div class="nav-sep"></div>${secondaryLinks}</nav>`;
 const mob=document.getElementById('mobile-bar');
 if(mob) mob.innerHTML=`<span class="mobile-brand">7<b>METROS</b></span><button id="menu-open" class="icon-btn" aria-label="Abrir menú">${icon('menu')}</button>`;
 document.querySelectorAll('[data-current-date]').forEach(x=>x.textContent=currentDateLabel());
 const open=document.getElementById('menu-open'), overlay=document.getElementById('overlay');
 open?.addEventListener('click',()=>{sidebar?.classList.add('open');overlay?.classList.add('show')});
 overlay?.addEventListener('click',()=>{sidebar?.classList.remove('open');overlay.classList.remove('show')});
 sidebar?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{sidebar.classList.remove('open');overlay?.classList.remove('show')}));
 document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)});
}
function showToast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}

function renderClubes(){const grid=document.getElementById('club-grid'),q=document.getElementById('club-search');if(!grid)return;function go(){const term=(q?.value||'').toLowerCase();const all=clubs();const rows=all.filter(c=>`${c.name} ${c.city}`.toLowerCase().includes(term));const empty=all.length?'<div class="card empty-state">No se encontraron clubes con esa búsqueda.</div>':'<div class="card empty-state">Todavía no hay clubes cargados.<br><button class="btn gold admin-lock" type="button" style="margin-top:10px">+ Cargar club</button></div>';grid.innerHTML=rows.map(c=>`<a class="card club-card club-grid-link" href="club.html?id=${c.id}">${badge(c)}<div><h3>${esc(c.name)}</h3><p>${esc(c.city)} · Clausura 2026</p></div><div class="club-card-stats"><span><b>${c.players}</b>Jugadores</span><span><b>${c.played}</b>Partidos</span><span><b>${c.points}</b>Puntos</span></div></a>`).join('')||empty}q?.addEventListener('input',go);go()}
function renderJugadores(){const tbody=document.getElementById('players-body'),q=document.getElementById('player-search'),clubSel=document.getElementById('player-club'),posSel=document.getElementById('player-position');if(!tbody)return;clubs().forEach(c=>clubSel?.insertAdjacentHTML('beforeend',`<option value="${c.id}">${esc(c.name)}</option>`));function go(){const term=(q?.value||'').toLowerCase(),cid=clubSel?.value||'',pos=posSel?.value||'';const all=players();const rows=all.filter(p=>(`${p.name} ${p.club}`.toLowerCase().includes(term))&&(!cid||Number(p.clubId)===Number(cid))&&(!pos||p.position===pos));const empty=all.length?'<tr><td colspan="8" class="empty-state">No se encontraron jugadores con estos filtros.</td></tr>':'<tr><td colspan="8" class="empty-state">Todavía no hay jugadores cargados.<br><button class="btn gold admin-lock" type="button" style="margin-top:10px">+ Cargar jugador</button></td></tr>';tbody.innerHTML=rows.map(p=>`<tr><td><div class="player-cell"><span class="avatar">${initials(p.name)}</span>${esc(p.name)}</div></td><td>${esc(p.club)}</td><td>${p.number}</td><td><span class="tag">${esc(p.position)}</span></td><td>${p.goals}</td><td>${p.assists}</td><td>${p.eff}%</td><td>${p.sanctions}</td></tr>`).join('')||empty}q?.addEventListener('input',go);clubSel?.addEventListener('change',go);posSel?.addEventListener('change',go);go()}
function renderPlanteles(){const sel=document.getElementById('roster-club'),wrap=document.getElementById('roster-wrap'),status=document.getElementById('roster-status');if(!wrap)return;const cs=clubs();if(!cs.length){document.getElementById('roster-title').textContent='Planteles';wrap.innerHTML='<div class="card empty-state" style="grid-column:1/-1">No hay clubes ni planteles cargados. Se mostrarán cuando conectemos la base real.<br><button class="btn gold admin-lock" type="button" style="margin-top:10px">+ Cargar club</button></div>';if(sel){sel.innerHTML='<option>Sin clubes cargados</option>';sel.disabled=true}if(status){status.textContent='SIN DATOS CARGADOS';status.classList.remove('hidden')}return}if(status){status.textContent='';status.classList.add('hidden')}cs.forEach(c=>sel?.insertAdjacentHTML('beforeend',`<option value="${c.id}">${esc(c.name)}</option>`));function go(){const cid=sel?.value||cs[0].id,c=club(cid),list=players().filter(p=>Number(p.clubId)===Number(cid)),positions=['Arquero','Extremo','Lateral','Central','Pivote'];document.getElementById('roster-title').textContent=`Plantel — ${c.name}`;wrap.innerHTML=positions.map(pos=>{const ps=list.filter(p=>p.position===pos);return `<section class="card position-column"><h3>${pos.toUpperCase()}</h3>${ps.map(p=>`<div class="roster-player"><span class="avatar">${p.number}</span><div><b>${esc(p.name)}</b><small>#${p.number}</small></div></div>`).join('')||'<div class="roster-player"><small>Sin jugadores cargados</small></div>'}</section>`}).join('')}sel?.addEventListener('change',go);go()}
function renderPartidos(){const list=document.getElementById('matches-list'),status=document.getElementById('match-status');if(!list)return;function go(){const st=status?.value||'';const all=matches();const rows=all.filter(m=>!st||m.status===st).sort((a,b)=>b.date.localeCompare(a.date));const empty=all.length?'<div class="card empty-state">No hay partidos para este filtro.</div>':'<div class="card empty-state">Todavía no hay partidos cargados.<br><button class="btn gold admin-lock" type="button" style="margin-top:10px">+ Cargar partido</button></div>';list.innerHTML=rows.map(m=>{const hc=club(m.homeId),ac=club(m.awayId),res=m.status==='Finalizado'?`${m.homeScore} - ${m.awayScore}`:'VS';return `<article class="card match-row"><div class="match-date"><b>${formatDateISO(m.date)}</b><br>${esc(m.round)}</div><div class="match-team">${badge(hc,true)}<span>${esc(m.home)}</span></div><div class="result">${res}<small>${m.status==='Finalizado'?'FINAL':esc(m.time)}</small></div><div class="match-team"><span>${esc(m.away)}</span>${badge(ac,true)}</div><a class="match-link" href="partido.html?id=${m.id}">VER DETALLE ›</a></article>`}).join('')||empty}status?.addEventListener('change',go);go()}
function renderParticipaciones(){const tbody=document.getElementById('participations-body');if(!tbody)return;const rows=players().slice().sort((a,b)=>b.goals-a.goals);tbody.innerHTML=rows.map((p,i)=>`<tr><td>${i+1}</td><td><div class="player-cell"><span class="avatar">${initials(p.name)}</span>${esc(p.name)}</div></td><td>${esc(p.club)}</td><td>-</td><td>${p.goals}</td><td>${p.assists}</td><td>${p.eff}%</td><td>${p.sanctions}</td></tr>`).join('')||'<tr><td colspan="8" class="empty-state">No hay participaciones cargadas.</td></tr>'}
function renderStats(){const ps=players();const status=document.getElementById('chart-status');const configs=[['goals-list','goals','Goles'],['assists-list','assists','Asist.'],['eff-list','eff','%'],['sanctions-list','sanctions','Sanc.']];configs.forEach(([id,key,unit])=>{const el=document.getElementById(id);if(!el)return;const rows=ps.slice().sort((a,b)=>b[key]-a[key]).slice(0,5);el.innerHTML=rows.map((p,i)=>`<div class="leader-row"><span class="rank">${i+1}</span><span class="leader-name">${esc(p.name)}<small>${esc(p.club)}</small></span><span class="leader-value">${p[key]}${unit==='%'?'%':''}</span></div>`).join('')||'<div class="empty-state">Sin datos cargados.</div>'});const chart=document.getElementById('club-goals-chart');if(chart){const groups=clubs().map(c=>({name:c.name,value:ps.filter(p=>p.clubId===c.id).reduce((s,p)=>s+p.goals,0)})).sort((a,b)=>b.value-a.value);if(!groups.length){chart.innerHTML='<div class="empty-state">Todavía no hay estadísticas cargadas.<br><button class="btn gold admin-lock" type="button" style="margin-top:10px">+ Cargar partido</button></div>';if(status){status.textContent='SIN DATOS CARGADOS';status.classList.remove('hidden')}return}if(status){status.textContent='';status.classList.add('hidden')}const max=Math.max(...groups.map(x=>x.value),1);chart.innerHTML=groups.map(x=>`<div class="bar-row"><span>${esc(x.name)}</span><div class="bar-track"><div class="bar-fill" style="--w:${Math.round(x.value/max*100)}%"></div></div><span class="bar-value">${x.value}</span></div>`).join('')}}
function renderPartidoDetalle(){const el=document.getElementById('match-detail');if(!el)return;const all=matches();if(!all.length){el.innerHTML='<div class="card empty-state">No hay partidos cargados para mostrar.</div>';return}const id=Number(new URLSearchParams(location.search).get('id')||all[0].id),m=all.find(x=>x.id===id)||all[0],hc=club(m.homeId),ac=club(m.awayId);el.innerHTML=`<section class="card section-card"><div class="section-head"><h2>${esc(m.round)}</h2><span>${formatDateISO(m.date)} · ${esc(m.time)}</span></div><div class="match-main"><div>${badge(hc)}<div class="club-name">${esc(m.home)}</div></div><div><div class="score">${m.status==='Finalizado'?`${m.homeScore} - ${m.awayScore}`:'VS'}</div><span class="status-pill">${esc(m.status).toUpperCase()}</span></div><div>${badge(ac)}<div class="club-name">${esc(m.away)}</div></div></div></section>`}
function renderClubDetalle(){const el=document.getElementById('club-detail');if(!el)return;const all=clubs();if(!all.length){el.innerHTML='<div class="card empty-state">Todavía no hay clubes cargados. Esta ficha se completará automáticamente cuando conectemos la base real.<br><button class="btn gold admin-lock" type="button" style="margin-top:10px">+ Cargar club</button></div>';return}const id=new URLSearchParams(location.search).get('id')||all[0].id,c=all.find(x=>String(x.id)===String(id))||all[0];const list=players().filter(p=>p.clubId===c.id),positions=['Arquero','Extremo','Lateral','Central','Pivote'];const ms=matches().filter(m=>m.homeId===c.id||m.awayId===c.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);const h1=document.querySelector('.page-header h1'),sub=document.querySelector('.page-header p');if(h1)h1.textContent=c.name;if(sub)sub.textContent=`${c.city||''} · Ficha de club`;el.innerHTML=`<section class="card section-card club-hero"><div class="club-hero-main">${badge(c)}<div><h2>${esc(c.name)}</h2><p>${esc(c.city||'')} · Clausura 2026</p></div></div><div class="club-card-stats"><span><b>${c.players??list.length}</b>Jugadores</span><span><b>${c.played??ms.length}</b>Partidos</span><span><b>${c.points??0}</b>Puntos</span></div></section><section class="card section-card" style="margin-top:14px"><div class="section-head"><h2>PLANTEL</h2><a href="planteles.html">VER PLANTELES ›</a></div><div class="roster-grid">${positions.map(pos=>{const ps=list.filter(p=>p.position===pos);return `<section class="card position-column"><h3>${pos.toUpperCase()}</h3>${ps.map(p=>`<div class="roster-player"><span class="avatar">${p.number}</span><div><b>${esc(p.name)}</b><small>#${p.number}</small></div></div>`).join('')||'<div class="roster-player"><small>Sin jugadores cargados</small></div>'}</section>`}).join('')}</div></section><section class="card section-card" style="margin-top:14px"><div class="section-head"><h2>ÚLTIMOS PARTIDOS</h2><a href="partidos.html">VER TODOS</a></div><div class="match-list">${ms.map(m=>{const hc=club(m.homeId),ac=club(m.awayId),res=m.status==='Finalizado'?`${m.homeScore} - ${m.awayScore}`:'VS';return `<article class="card match-row"><div class="match-date"><b>${formatDateISO(m.date)}</b><br>${esc(m.round)}</div><div class="match-team">${badge(hc,true)}<span>${esc(m.home)}</span></div><div class="result">${res}<small>${m.status==='Finalizado'?'FINAL':esc(m.time)}</small></div><div class="match-team"><span>${esc(m.away)}</span>${badge(ac,true)}</div><a class="match-link" href="partido.html?id=${m.id}">VER DETALLE ›</a></article>`}).join('')||'<div class="empty-state">Sin partidos cargados para este club.</div>'}</div></section>`}
function initCompetitionFilters() {
    const tools = document.querySelector('.header-tools');
    if (!tools || !baseTeams.length) return;

    const seasonSelect = document.getElementById('season-select');
    if (seasonSelect) {
        seasonSelect.innerHTML = '<option value="3">CLAUSURA 2026</option>';
        seasonSelect.value = '3';
        seasonSelect.disabled = true;
        seasonSelect.title = 'Temporada';
    }

    const createSelect = (id, title) => {
        let sel = document.getElementById(id);

        if (!sel) {
            sel = document.createElement('select');
            sel.id = id;
            sel.className = 'select-dark';
            sel.title = title;
            tools.appendChild(sel);
        }

        return sel;
    };

    const categoriaSel = createSelect('category-select', 'Categoría');
    const divisionSel = createSelect('division-select', 'División');
    const ramaSel = createSelect('branch-select', 'Rama');

    const unique = values =>
        [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))];

    const equiposTemporada = baseTeams.filter(
        e => Number(e.temporada_id) === CURRENT_SEASON_ID
    );

    const categorias = unique(equiposTemporada.map(e => e.categoria));

    if (!categorias.includes(competitionFilters.categoria)) {
        competitionFilters.categoria =
            categorias.includes('Mayores') ? 'Mayores' : (categorias[0] || '');
    }

    categoriaSel.innerHTML = categorias
        .map(v => `<option value="${esc(v)}">CATEGORÍA: ${esc(v)}</option>`)
        .join('');

    categoriaSel.value = competitionFilters.categoria;

    const equiposCategoria = equiposTemporada.filter(
        e => !competitionFilters.categoria || e.categoria === competitionFilters.categoria
    );

    const divisiones = unique(equiposCategoria.map(e => e.division));

    if (!divisiones.includes(competitionFilters.division)) {
        competitionFilters.division =
            divisiones.includes('LHC Hipotecario Seguros')
                ? 'LHC Hipotecario Seguros'
                : (divisiones[0] || '');
    }

    divisionSel.innerHTML = divisiones
        .map(v => `<option value="${esc(v)}">DIVISIÓN: ${esc(v)}</option>`)
        .join('');

    divisionSel.value = competitionFilters.division;

    const equiposDivision = equiposCategoria.filter(
        e => !competitionFilters.division || e.division === competitionFilters.division
    );

    const ramas = unique(equiposDivision.map(e => e.rama));

    if (!ramas.includes(competitionFilters.rama)) {
        competitionFilters.rama =
            ramas.includes('M') ? 'M' : (ramas[0] || '');
    }

    const ramaLabel = rama => {
        if (rama === 'M') return 'Masculino';
        if (rama === 'F') return 'Femenino';
        return rama;
    };

    ramaSel.innerHTML = ramas
        .map(v => `<option value="${esc(v)}">RAMA: ${esc(ramaLabel(v))}</option>`)
        .join('');

    ramaSel.value = competitionFilters.rama;

    localStorage.setItem('7m_categoria', competitionFilters.categoria);
    localStorage.setItem('7m_division', competitionFilters.division);
    localStorage.setItem('7m_rama', competitionFilters.rama);

    categoriaSel.addEventListener('change', () => {
        localStorage.setItem('7m_categoria', categoriaSel.value);
        localStorage.removeItem('7m_division');
        localStorage.removeItem('7m_rama');
        location.reload();
    });

    divisionSel.addEventListener('change', () => {
        localStorage.setItem('7m_division', divisionSel.value);
        localStorage.removeItem('7m_rama');
        location.reload();
    });

    ramaSel.addEventListener('change', () => {
        localStorage.setItem('7m_rama', ramaSel.value);
        location.reload();
    });
}
function initForms(){const pf=document.getElementById('player-form');if(pf){const cs=clubs();cs.forEach(c=>pf.elements.clubId.insertAdjacentHTML('beforeend',`<option value="${c.id}">${esc(c.name)}</option>`));if(!cs.length){pf.elements.clubId.innerHTML='<option value="">Sin clubes cargados</option>';pf.querySelector('button[type="submit"]')?.setAttribute('disabled','disabled')}pf.addEventListener('submit',e=>{e.preventDefault();showToast('La carga real se habilitará al conectar Flask + SQLite.')})}const mf=document.getElementById('match-form');if(mf){const cs=clubs();cs.forEach(c=>{mf.elements.homeId.insertAdjacentHTML('beforeend',`<option value="${c.id}">${esc(c.name)}</option>`);mf.elements.awayId.insertAdjacentHTML('beforeend',`<option value="${c.id}">${esc(c.name)}</option>`)});if(!cs.length){mf.elements.homeId.innerHTML='<option value="">Sin clubes cargados</option>';mf.elements.awayId.innerHTML='<option value="">Sin clubes cargados</option>';mf.querySelector('button[type="submit"]')?.setAttribute('disabled','disabled')}mf.addEventListener('submit',e=>{e.preventDefault();showToast('La carga real se habilitará al conectar Flask + SQLite.')})}}
function initSettings(){document.querySelectorAll('[data-setting]').forEach(input=>{const key='7m_setting_'+input.dataset.setting;input.checked=localStorage.getItem(key)==='1';input.addEventListener('change',()=>{localStorage.setItem(key,input.checked?'1':'0');showToast('Preferencia guardada en este navegador.')})})}
function initReports(){document.querySelectorAll('[data-report]').forEach(btn=>btn.addEventListener('click',()=>{const type=btn.dataset.report;let rows,name;if(type==='jugadores'){rows=[['Jugador','Club','Dorsal','Posicion','Goles','Asistencias','Efectividad','Sanciones'],...players().map(p=>[p.name,p.club,p.number,p.position,p.goals,p.assists,p.eff,p.sanctions])];name='7metros_jugadores.csv'}else if(type==='partidos'){rows=[['Fecha','Local','Visitante','Estado','Resultado'],...matches().map(m=>[m.date,m.home,m.away,m.status,m.status==='Finalizado'?`${m.homeScore}-${m.awayScore}`:''])];name='7metros_partidos.csv'}else{rows=[['Jugador','Goles','Asistencias','Efectividad','Sanciones'],...players().map(p=>[p.name,p.goals,p.assists,p.eff,p.sanctions])];name='7metros_estadisticas.csv'}const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Reporte CSV generado.')}))}


function renderDashboard(){
 const kpis=document.querySelectorAll('.kpi-value');
 if(kpis.length>=5){const ps=players(),ms=matches();const finished=ms.filter(m=>m.status==='Finalizado');kpis[0].textContent=clubs().length;kpis[1].textContent=ps.length;kpis[2].textContent=ms.length;kpis[3].textContent=finished.reduce((s,m)=>s+(Number(m.homeScore)||0)+(Number(m.awayScore)||0),0);kpis[4].textContent=ps.reduce((s,p)=>s+(Number(p.sanctions)||0),0)}
 const last=document.getElementById('dashboard-last');if(last){const m=matches().filter(x=>x.status==='Finalizado').sort((a,b)=>b.date.localeCompare(a.date))[0];last.innerHTML=m?`<div class="match-main"><div>${badge(club(m.homeId))}<div class="club-name">${esc(m.home)}</div></div><div><div class="score">${m.homeScore} - ${m.awayScore}</div><span class="status-pill">FINALIZADO</span></div><div>${badge(club(m.awayId))}<div class="club-name">${esc(m.away)}</div></div></div>`:'<div class="empty-state">Todavía no hay partidos cargados.<br><button class="btn gold admin-lock" type="button" style="margin-top:10px">+ Cargar partido</button></div>'}
 const next=document.getElementById('dashboard-next');if(next){const today=new Date().toISOString().slice(0,10);const rows=matches().filter(x=>x.status!=='Finalizado'&&x.date>=today).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,3);next.innerHTML=rows.map(m=>`<div class="fixture">${dateBox(m.date)}${badge(club(m.homeId),true)}<span class="team-text">${esc(m.home)}</span><span class="versus">VS<small>${esc(m.time)}</small></span><span class="team-text">${esc(m.away)}</span>${badge(club(m.awayId),true)}</div>`).join('')||'<div class="empty-state">No hay próximos partidos cargados.<br><button class="btn light admin-lock" type="button" style="margin-top:10px">+ Cargar partido</button></div>'}
 const high=document.getElementById('dashboard-highlights');if(high){const ps=players();if(!ps.length){high.innerHTML='<div class="empty-state" style="grid-column:1/-1">Todavía no hay estadísticas cargadas.<br><button class="btn gold admin-lock" type="button" style="margin-top:10px">+ Cargar partido</button></div>'}else{const top=(key)=>ps.slice().sort((a,b)=>(Number(b[key])||0)-(Number(a[key])||0))[0];const g=top('goals'),e=top('eff'),a=top('assists'),s=top('sanctions');high.innerHTML=[[g,'GOLEADOR DEL TORNEO','goals','GOLES'],[e,'EFECTIVIDAD','eff','%'],[a,'MÁS ASISTENCIAS','assists','ASISTENCIAS'],[s,'MÁS SANCIONES','sanctions','SANCIONES']].map(([p,k,key,u])=>`<div class="highlight-item"><span class="highlight-kicker">${k}</span><b class="highlight-name">${esc(p.name)}</b><span class="highlight-club">${esc(p.club)}</span><strong class="highlight-number">${p[key]}${u==='%'?'%':''}</strong><span class="highlight-unit">${u}</span></div>`).join('')}}
}

function initAdminLocks(){
 document.addEventListener('click',e=>{
  const el=e.target.closest('.admin-lock');
  if(!el) return;
  e.preventDefault();
  showToast('Acceso restringido. La carga de datos se habilitará para usuarios autorizados una vez conectemos la base real.');
 });
}

document.addEventListener('DOMContentLoaded', async () => {

    renderShell();

    initSettings();

    initReports();

    initAdminLocks();

    await cargarDatosSupabase();

    initCompetitionFilters();

    renderDashboard();
    renderClubes();
    renderClubDetalle();
    renderJugadores();
    renderPlanteles();
    renderPartidos();
    renderParticipaciones();
    renderStats();
    renderPartidoDetalle();

    initForms();

});
