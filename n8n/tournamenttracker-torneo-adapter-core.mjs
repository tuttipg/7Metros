function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} debe ser array`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} inválido`);
  return value.trim();
}

function scoreFromTournamentTracker(value, label) {
  const raw = requireString(value, label);
  if (!/^\d+$/.test(raw)) throw new Error(`${label} debe ser entero no negativo`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} fuera de rango`);
  return parsed;
}

function dateFromHorario(value, label) {
  const raw = requireString(value, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)/.exec(raw);
  if (!match) throw new Error(`${label} no contiene fecha ISO explícita`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${label} contiene fecha calendario inválida`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function adaptMatch(match, phaseIndex, zoneIndex, matchIndex) {
  requireObject(match, `Partido ${phaseIndex}/${zoneIndex}/${matchIndex}`);
  const planillas = requireArray(match.planillas, `planillas de partido ${phaseIndex}/${zoneIndex}/${matchIndex}`);
  return {
    tournamenttracker_match_id: requireString(match.id, `id de partido ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    fase_id: requireString(match.__fase_id, `fase id ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    zona_id: requireString(match.__zona_id, `zona id ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    numero_fecha: requireString(match.numeroFecha, `numeroFecha ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    fecha: dateFromHorario(match.horario, `horario ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    local: requireString(match.nombreLocal, `nombreLocal ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    visitante: requireString(match.nombreVisitante, `nombreVisitante ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    goles_local: scoreFromTournamentTracker(match.golesLocal, `golesLocal ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    goles_visitante: scoreFromTournamentTracker(match.golesVisitante, `golesVisitante ${phaseIndex}/${zoneIndex}/${matchIndex}`),
    planillas: planillas.map((planilla, sheetIndex) => {
      requireObject(planilla, `planilla ${phaseIndex}/${zoneIndex}/${matchIndex}/${sheetIndex}`);
      return { ...planilla };
    }),
  };
}

export function adaptTournamentTrackerTorneoOffline({ torneo, evidence }) {
  requireObject(evidence, 'Evidencia offline');
  if (evidence.source !== 'tournamenttracker_decrypted_torneo_offline') throw new Error('source de evidencia inválido');
  if (evidence.network_used !== false) throw new Error('El adaptador offline exige network_used=false');
  if (evidence.auth_used !== false) throw new Error('La evidencia no puede usar autenticación');
  if (evidence.write_enabled !== false) throw new Error('La evidencia no puede habilitar escritura');

  requireObject(torneo, 'Torneo TournamentTracker');
  const torneoId = requireString(torneo.id, 'Torneo.id');
  const fases = requireArray(torneo.fases, 'Torneo.fases');
  const partidos = [];

  fases.forEach((fase, phaseIndex) => {
    requireObject(fase, `Fase ${phaseIndex}`);
    const faseId = requireString(fase.id, `Fase ${phaseIndex}.id`);
    const zonas = requireArray(fase.zonas, `Fase ${phaseIndex}.zonas`);
    zonas.forEach((zona, zoneIndex) => {
      requireObject(zona, `Zona ${phaseIndex}/${zoneIndex}`);
      const zonaId = requireString(zona.id, `Zona ${phaseIndex}/${zoneIndex}.id`);
      const zonaPartidos = requireArray(zona.partidos, `Zona ${phaseIndex}/${zoneIndex}.partidos`);
      zonaPartidos.forEach((match, matchIndex) => {
        partidos.push(adaptMatch({ ...match, __fase_id: faseId, __zona_id: zonaId }, phaseIndex, zoneIndex, matchIndex));
      });
    });
  });

  return {
    source: 'tournamenttracker_offline_fixture',
    network_used: false,
    auth_used: false,
    write_enabled: false,
    tournamenttracker_torneo_id: torneoId,
    partidos,
  };
}
