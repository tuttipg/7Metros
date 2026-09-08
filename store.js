import { loadPublicDataset } from './api.js';
import { DEFAULT_FILTERS, SEASON_ID, STORAGE_KEYS } from './config.js';
import { field, numericField, initials, ratio, toNumber, unique, bySpanishName } from './utils.js';

function settingEnabled(key, defaultValue = false) {
  const stored = localStorage.getItem(key);
  if (stored === null) return defaultValue;
  return stored === '1';
}

function initialFilters() {
  const remember = settingEnabled(STORAGE_KEYS.rememberFilters, true);
  if (!remember) return { ...DEFAULT_FILTERS };
  return {
    categoria: localStorage.getItem(STORAGE_KEYS.categoria) || DEFAULT_FILTERS.categoria,
    division: localStorage.getItem(STORAGE_KEYS.division) || DEFAULT_FILTERS.division,
    rama: localStorage.getItem(STORAGE_KEYS.rama) || DEFAULT_FILTERS.rama
  };
}

export const state = {
  loading: false,
  loaded: false,
  error: null,
  loadedAt: null,
  filters: initialFilters(),
  clubs: [],
  teams: [],
  players: [],
  rosters: [],
  matches: [],
  participations: [],
  index: {
    clubById: new Map(),
    teamById: new Map(),
    playerById: new Map(),
    rosterByPlayer: new Map(),
    rosterByTeam: new Map(),
    participationsByPlayer: new Map(),
    participationsByMatch: new Map(),
    matchById: new Map()
  }
};

function pushMapList(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function prepareDataset(dataset) {
  state.teams = (dataset.equipos || []).map(row => ({
    ...row,
    id: Number(row.id),
    club_id: Number(row.club_id),
    temporada_id: Number(row.temporada_id)
  })).filter(row => Number.isFinite(row.id));

  state.clubs = (dataset.clubes || []).map(row => ({
    id: Number(row.id),
    name: row.nombre || 'Club',
    abbr: initials(row.nombre || '7Metros')
  })).filter(row => Number.isFinite(row.id));

  state.players = (dataset.jugadores || []).map(row => ({
    id: Number(row.id),
    firstName: row.nombre || '',
    lastName: row.apellido || '',
    name: `${row.nombre || ''} ${row.apellido || ''}`.trim() || 'Jugador',
    birthDate: row.fecha_nacimiento || null,
    dominantArm: row.brazo_habil || null,
    height: numericField(row, ['altura_cm']),
    weight: numericField(row, ['peso_kg'])
  })).filter(row => Number.isFinite(row.id));

  state.rosters = (dataset.planteles || []).map(row => ({
    ...row,
    id: Number(row.id),
    jugador_id: Number(row.jugador_id),
    equipo_id: Number(row.equipo_id),
    dorsal: row.dorsal ?? null,
    posicion: row.posicion || 'Sin posición'
  })).filter(row => Number.isFinite(row.jugador_id) && Number.isFinite(row.equipo_id));

  state.participations = (dataset.participaciones || []).map(row => ({
    ...row,
    id: Number(row.id),
    partido_id: Number(row.partido_id),
    jugador_id: Number(row.jugador_id),
    equipo_id: Number(row.equipo_id)
  })).filter(row => Number.isFinite(row.jugador_id));

  const teamById = new Map(state.teams.map(row => [row.id, row]));
  const clubById = new Map(state.clubs.map(row => [row.id, row]));

  state.matches = (dataset.partidos || []).map(row => {
    const homeTeamId = Number(field(row, ['local_equipo_id', 'local_id'], NaN));
    const awayTeamId = Number(field(row, ['visitante_equipo_id', 'visitante_id'], NaN));
    const homeTeam = teamById.get(homeTeamId) || null;
    const awayTeam = teamById.get(awayTeamId) || null;
    if (!homeTeam && !awayTeam) return null;

    const homeClub = homeTeam ? clubById.get(Number(homeTeam.club_id)) : null;
    const awayClub = awayTeam ? clubById.get(Number(awayTeam.club_id)) : null;
    const statusRaw = String(field(row, ['estado'], '') || '').toLowerCase();
    const hasScores = field(row, ['goles_local'], null) !== null && field(row, ['goles_visitante'], null) !== null;
    const finished = statusRaw === 'finalizado' || statusRaw === 'final' || (hasScores && statusRaw !== 'programado');

    return {
      id: Number(row.id),
      date: field(row, ['fecha'], ''),
      time: String(field(row, ['hora'], '') || '').slice(0, 5),
      round: field(row, ['jornada', 'fecha_torneo'], null),
      roundLabel: field(row, ['jornada', 'fecha_torneo'], null) ? `Fecha ${field(row, ['jornada', 'fecha_torneo'])}` : 'Partido',
      homeTeamId: Number.isFinite(homeTeamId) ? homeTeamId : null,
      awayTeamId: Number.isFinite(awayTeamId) ? awayTeamId : null,
      homeClubId: homeClub?.id ?? null,
      awayClubId: awayClub?.id ?? null,
      home: homeClub?.name || homeTeam?.nombre_femebal || field(row, ['local'], 'Local'),
      away: awayClub?.name || awayTeam?.nombre_femebal || field(row, ['visitante'], 'Visitante'),
      homeScore: finished ? toNumber(field(row, ['goles_local'], 0)) : null,
      awayScore: finished ? toNumber(field(row, ['goles_visitante'], 0)) : null,
      status: finished ? 'Finalizado' : 'Programado',
      notes: field(row, ['observaciones', 'notas'], '') || '',
      planillaUrl: field(row, ['fuente_planilla', 'planilla_url', 'url_planilla', 'link_planilla'], null),
      videoUrl: field(row, ['fuente_video', 'video_url', 'url_video', 'link_video'], null),
      raw: row
    };
  }).filter(Boolean);

  // Índices para evitar filtros O(n²) en los renders.
  state.index.clubById = new Map(state.clubs.map(row => [row.id, row]));
  state.index.teamById = new Map(state.teams.map(row => [row.id, row]));
  state.index.playerById = new Map(state.players.map(row => [row.id, row]));
  state.index.matchById = new Map(state.matches.map(row => [row.id, row]));
  state.index.rosterByPlayer = new Map();
  state.index.rosterByTeam = new Map();
  state.index.participationsByPlayer = new Map();
  state.index.participationsByMatch = new Map();

  state.rosters.forEach(row => {
    pushMapList(state.index.rosterByPlayer, row.jugador_id, row);
    pushMapList(state.index.rosterByTeam, row.equipo_id, row);
  });
  state.participations.forEach(row => {
    pushMapList(state.index.participationsByPlayer, row.jugador_id, row);
    if (Number.isFinite(row.partido_id)) pushMapList(state.index.participationsByMatch, row.partido_id, row);
  });
}

export async function loadData() {
  state.loading = true;
  state.error = null;
  try {
    const dataset = await loadPublicDataset(SEASON_ID);
    prepareDataset(dataset);
    normalizeFilters();
    state.loaded = true;
    state.loadedAt = new Date();
  } catch (error) {
    state.error = error;
    state.loaded = false;
    throw error;
  } finally {
    state.loading = false;
  }
}

export function getCompetitionOptions(filters = state.filters) {
  const seasonTeams = state.teams.filter(team => Number(team.temporada_id) === SEASON_ID);
  const categorias = unique(seasonTeams.map(team => team.categoria)).sort(bySpanishName);
  const categoria = categorias.includes(filters.categoria)
    ? filters.categoria
    : (categorias.includes(DEFAULT_FILTERS.categoria) ? DEFAULT_FILTERS.categoria : (categorias[0] || ''));

  const categoryTeams = seasonTeams.filter(team => !categoria || team.categoria === categoria);
  const divisiones = unique(categoryTeams.map(team => team.division)).sort(bySpanishName);
  const division = divisiones.includes(filters.division)
    ? filters.division
    : (divisiones.includes(DEFAULT_FILTERS.division) ? DEFAULT_FILTERS.division : (divisiones[0] || ''));

  const divisionTeams = categoryTeams.filter(team => !division || team.division === division);
  const ramas = unique(divisionTeams.map(team => team.rama)).sort(bySpanishName);
  const rama = ramas.includes(filters.rama)
    ? filters.rama
    : (ramas.includes(DEFAULT_FILTERS.rama) ? DEFAULT_FILTERS.rama : (ramas[0] || ''));

  return { categorias, divisiones, ramas, resolved: { categoria, division, rama } };
}

export function normalizeFilters() {
  const { resolved } = getCompetitionOptions(state.filters);
  state.filters = { ...resolved };
  persistFilters();
}

export function setFilters(next) {
  state.filters = { ...state.filters, ...next };
  normalizeFilters();
}

export function persistFilters() {
  const remember = settingEnabled(STORAGE_KEYS.rememberFilters, true);
  if (!remember) return;
  localStorage.setItem(STORAGE_KEYS.categoria, state.filters.categoria || '');
  localStorage.setItem(STORAGE_KEYS.division, state.filters.division || '');
  localStorage.setItem(STORAGE_KEYS.rama, state.filters.rama || '');
}

export function clearStoredFilters() {
  localStorage.removeItem(STORAGE_KEYS.categoria);
  localStorage.removeItem(STORAGE_KEYS.division);
  localStorage.removeItem(STORAGE_KEYS.rama);
  state.filters = { ...DEFAULT_FILTERS };
  if (state.loaded) normalizeFilters();
}

export function filteredTeams() {
  const f = state.filters;
  return state.teams.filter(team =>
    Number(team.temporada_id) === SEASON_ID &&
    (!f.categoria || team.categoria === f.categoria) &&
    (!f.division || team.division === f.division) &&
    (!f.rama || team.rama === f.rama)
  );
}

export function filteredTeamIds() {
  return new Set(filteredTeams().map(team => team.id));
}

export function getMatches() {
  const allowed = filteredTeamIds();
  return state.matches.filter(match =>
    allowed.has(Number(match.homeTeamId)) && allowed.has(Number(match.awayTeamId))
  );
}

function participationStats(playerId, allowedTeamIds = filteredTeamIds()) {
  const rows = (state.index.participationsByPlayer.get(Number(playerId)) || [])
    .filter(row => !row.equipo_id || allowedTeamIds.has(Number(row.equipo_id)));

  const matchIds = new Set(rows.map(row => Number(row.partido_id)).filter(Number.isFinite));
  const goals = rows.reduce((sum, row) => sum + toNumber(field(row, ['goles'], 0)), 0);
  const twoMin = rows.reduce((sum, row) => sum + toNumber(field(row, ['exclusiones_2min', 'dos_minutos'], 0)), 0);
  const yellow = rows.reduce((sum, row) => sum + toNumber(field(row, ['tarjeta_amarilla', 'amarillas'], 0)), 0);
  const red = rows.reduce((sum, row) => sum + toNumber(field(row, ['tarjeta_roja', 'rojas'], 0)), 0);

  const assistValues = rows.map(row => numericField(row, ['asistencias', 'assists'])).filter(v => v !== null);
  const shotValues = rows.map(row => numericField(row, ['lanzamientos', 'tiros', 'shots'])).filter(v => v !== null);
  const savesValues = rows.map(row => numericField(row, ['atajadas', 'paradas', 'saves'])).filter(v => v !== null);

  const assists = assistValues.length ? assistValues.reduce((a, b) => a + b, 0) : null;
  const shots = shotValues.length ? shotValues.reduce((a, b) => a + b, 0) : null;
  const saves = savesValues.length ? savesValues.reduce((a, b) => a + b, 0) : null;

  return {
    rows,
    matchIds,
    matchesPlayed: matchIds.size,
    goals,
    goalsPerMatch: ratio(goals, matchIds.size, 1),
    twoMin,
    yellow,
    red,
    sanctions: twoMin + yellow + red,
    assists,
    shots,
    efficiency: shots ? Number(((goals / shots) * 100).toFixed(1)) : null,
    saves
  };
}

export function getPlayers() {
  const allowedTeams = filteredTeamIds();
  const result = [];

  for (const player of state.players) {
    const memberships = (state.index.rosterByPlayer.get(player.id) || []).filter(m => allowedTeams.has(Number(m.equipo_id)));
    if (!memberships.length) continue;
    const membership = memberships[0];
    const team = state.index.teamById.get(Number(membership.equipo_id));
    const club = team ? state.index.clubById.get(Number(team.club_id)) : null;
    const stats = participationStats(player.id, allowedTeams);

    result.push({
      ...player,
      teamId: team?.id ?? null,
      clubId: club?.id ?? null,
      club: club?.name || 'Sin club',
      number: membership.dorsal ?? '—',
      position: membership.posicion || 'Sin posición',
      ...stats
    });
  }
  return result;
}

export function getPlayer(playerId) {
  return getPlayers().find(player => Number(player.id) === Number(playerId)) || null;
}

function resultForClub(match, clubId) {
  if (match.status !== 'Finalizado') return null;
  const home = Number(match.homeClubId) === Number(clubId);
  const own = home ? match.homeScore : match.awayScore;
  const opp = home ? match.awayScore : match.homeScore;
  if (own > opp) return 'W';
  if (own < opp) return 'L';
  return 'D';
}

export function getClubs() {
  const visibleClubIds = new Set(filteredTeams().map(team => Number(team.club_id)));
  const players = getPlayers();
  const matches = getMatches();

  return state.clubs
    .filter(club => visibleClubIds.has(Number(club.id)))
    .map(club => {
      const clubPlayers = players.filter(player => Number(player.clubId) === Number(club.id));
      const clubMatches = matches.filter(match => Number(match.homeClubId) === club.id || Number(match.awayClubId) === club.id);
      const finished = clubMatches.filter(match => match.status === 'Finalizado');
      let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

      finished.forEach(match => {
        const home = Number(match.homeClubId) === club.id;
        const own = home ? toNumber(match.homeScore) : toNumber(match.awayScore);
        const opp = home ? toNumber(match.awayScore) : toNumber(match.homeScore);
        gf += own; ga += opp;
        if (own > opp) won += 1;
        else if (own === opp) drawn += 1;
        else lost += 1;
      });

      const form = finished
        .slice()
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
        .slice(0, 5)
        .reverse()
        .map(match => resultForClub(match, club.id));

      return {
        ...club,
        players: clubPlayers.length,
        played: finished.length,
        won, drawn, lost,
        gf, ga,
        gd: gf - ga,
        points: won * 2 + drawn,
        goals: clubPlayers.reduce((sum, player) => sum + player.goals, 0),
        form
      };
    });
}

export function getClub(clubId) {
  return getClubs().find(club => Number(club.id) === Number(clubId)) || null;
}

export function getBaseClub(clubId) {
  return state.index.clubById.get(Number(clubId)) || null;
}

export function getStandings() {
  return getClubs().slice().sort((a, b) =>
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    bySpanishName(a.name, b.name)
  );
}

export function getMatch(matchId) {
  return getMatches().find(match => Number(match.id) === Number(matchId)) || null;
}

export function getMatchParticipations(matchId, teamId = null) {
  const rows = state.index.participationsByMatch.get(Number(matchId)) || [];
  const filtered = teamId ? rows.filter(row => Number(row.equipo_id) === Number(teamId)) : rows;

  return filtered.map(row => {
    const player = state.index.playerById.get(Number(row.jugador_id));
    const roster = (state.index.rosterByPlayer.get(Number(row.jugador_id)) || [])
      .find(item => Number(item.equipo_id) === Number(row.equipo_id));
    return {
      ...row,
      playerId: Number(row.jugador_id),
      playerName: player?.name || 'Jugador',
      number: field(row, ['dorsal_utilizado'], roster?.dorsal ?? '—'),
      position: roster?.posicion || '—',
      goals: toNumber(field(row, ['goles'], 0)),
      twoMin: toNumber(field(row, ['exclusiones_2min', 'dos_minutos'], 0)),
      yellow: toNumber(field(row, ['tarjeta_amarilla', 'amarillas'], 0)),
      red: toNumber(field(row, ['tarjeta_roja', 'rojas'], 0))
    };
  }).sort((a, b) => b.goals - a.goals || Number(a.number || 999) - Number(b.number || 999));
}

export function getPlayerMatchRows(playerId) {
  const player = getPlayer(playerId);
  if (!player) return [];
  const rows = player.rows || [];
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const match = state.index.matchById.get(Number(row.partido_id));
    if (!match || seen.has(match.id)) continue;
    if (!getMatches().some(m => m.id === match.id)) continue;
    seen.add(match.id);
    result.push({
      match,
      participation: row,
      goals: toNumber(field(row, ['goles'], 0)),
      twoMin: toNumber(field(row, ['exclusiones_2min', 'dos_minutos'], 0)),
      yellow: toNumber(field(row, ['tarjeta_amarilla', 'amarillas'], 0)),
      red: toNumber(field(row, ['tarjeta_roja', 'rojas'], 0))
    });
  }
  return result.sort((a, b) => `${b.match.date}${b.match.time}`.localeCompare(`${a.match.date}${a.match.time}`));
}

export function selectedCompetitionLabel() {
  const { categoria, division, rama } = state.filters;
  const branch = rama === 'M' ? 'Masculino' : rama === 'F' ? 'Femenino' : rama;
  return [categoria, division, branch].filter(Boolean).join(' · ');
}

export function dataSummary() {
  const matches = getMatches();
  const finished = matches.filter(m => m.status === 'Finalizado');
  const totalGoals = finished.reduce((sum, m) => sum + toNumber(m.homeScore) + toNumber(m.awayScore), 0);
  return {
    clubs: getClubs().length,
    players: getPlayers().length,
    matches: matches.length,
    finished: finished.length,
    goals: totalGoals,
    avgGoals: ratio(totalGoals, finished.length, 1)
  };
}
