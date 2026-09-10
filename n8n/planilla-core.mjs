function intOrZero(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '-') return 0;
  if (!/^\d+$/.test(text)) throw new Error(`Valor numérico inválido: ${text}`);
  return Number(text);
}

function requireMatch(text, re, label) {
  const match = text.match(re);
  if (!match) throw new Error(`No se pudo extraer ${label}`);
  return match[1].trim();
}

function parsePlayerLine(line) {
  const match = String(line).trim().match(/^(\d+)\s+(.+?),\s*(.+?)\s+(\d+|-)\s+(\d+|-)\s+(\d+|-)\s+(\d+|-)\s+(\d+|-)$/);
  if (!match) return null;
  return {
    dorsal: Number(match[1]),
    apellido: match[2].trim(),
    nombre: match[3].trim(),
    goles: intOrZero(match[4]),
    tarjeta_amarilla: intOrZero(match[5]),
    exclusiones_2min: intOrZero(match[6]),
    tarjeta_roja: intOrZero(match[7]),
    tarjeta_azul: intOrZero(match[8]),
  };
}

function parsePlayerSection(lines, startHeading, endHeading) {
  const start = lines.findIndex((line) => line.includes(startHeading));
  if (start < 0) throw new Error(`No se encontró sección ${startHeading}`);

  let end = lines.length;
  if (endHeading) {
    const found = lines.findIndex((line, index) => index > start && line.includes(endHeading));
    if (found >= 0) end = found;
  }

  const players = [];
  for (const line of lines.slice(start + 1, end)) {
    const parsed = parsePlayerLine(line);
    if (parsed) players.push(parsed);
  }

  if (!players.length) throw new Error(`La sección ${startHeading} no contiene jugadores`);
  return players;
}

function sum(players, field) {
  return players.reduce((total, player) => total + player[field], 0);
}

function findHeadingIndex(lines, heading, startAt = 0) {
  const target = heading.toLowerCase();
  return lines.findIndex((line, index) => index >= startAt && line.toLowerCase().includes(target));
}

function parseTeamNameAndDirectScore(lines, heading, stopHeading, label) {
  const start = findHeadingIndex(lines, heading);
  if (start < 0) throw new Error(`No se encontró ${heading}`);

  let end = lines.length;
  if (stopHeading) {
    const stop = findHeadingIndex(lines, stopHeading, start + 1);
    if (stop >= 0) end = stop;
  }

  const raw = lines.slice(start + 1, end).map((line) => line.trim()).filter(Boolean);
  const headerLines = [];

  for (const line of raw) {
    if (/^(goles\b|time-outs\b)/i.test(line)) break;
    headerLines.push(line);
  }

  for (const line of headerLines) {
    const match = line.match(/^(.+?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*?)\s+(\d+)$/);
    if (match) {
      return {
        nombre: match[1].trim(),
        goles: Number(match[2]),
        metodo: 'encabezado',
      };
    }
  }

  const nameIndex = headerLines.findIndex((line) =>
    /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(line) && !/^(equipo|goles|time-outs)/i.test(line));

  if (nameIndex < 0) {
    throw new Error(`No se pudo extraer nombre de ${label}. Encabezado: ${headerLines.join(' | ')}`);
  }

  const nombre = headerLines[nameIndex].trim();
  const nearby = headerLines.slice(nameIndex + 1, nameIndex + 4);
  const scoreLine = nearby.find((line) => /^\d+$/.test(line));

  if (scoreLine !== undefined) {
    return {
      nombre,
      goles: Number(scoreLine),
      metodo: 'encabezado_separado',
    };
  }

  return { nombre, goles: null, metodo: 'sin_total_directo' };
}

function parsePeriodTotals(flat) {
  const matches = [...flat.matchAll(
    /Goles\s+PT\s+(\d+)\s+ST\s+(\d+)\s+PTE\s+(\d+)\s+STE\s+(\d+)\s+P\s+(\d+)/gi,
  )];

  return matches.map((match) => ({
    pt: Number(match[1]),
    st: Number(match[2]),
    pte: Number(match[3]),
    ste: Number(match[4]),
    p: Number(match[5]),
  }));
}

function scoreFromPeriods(periods, label) {
  if (!periods) return null;
  if (periods.p !== 0) {
    throw new Error(`La planilla de ${label} tiene definición P=${periods.p}; requiere validación específica`);
  }
  return periods.pt + periods.st + periods.pte + periods.ste;
}

export function parseOfficialFemebalSheet(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('La planilla está vacía');

  const cleaned = text.replace(/\u00a0/g, ' ').replace(/\r/g, '');
  const lines = cleaned
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const flat = lines.join('\n');

  const fecha = requireMatch(flat, /(?:^|\n)Fecha:\s*\n?(\d{4}-\d{2}-\d{2})(?:\n|$)/i, 'fecha');
  const hora = requireMatch(flat, /(?:^|\n)Hora:\s*\n?(\d{2}:\d{2}:\d{2})(?:\n|$)/i, 'hora');
  const scope = requireMatch(flat, /(?:^|\n)Categoria\s*-\s*Division:\s*\n?([^\n]+)/i, 'categoría/división');
  const scopeParts = scope.split(/\s+-\s+/, 2);
  if (scopeParts.length !== 2) throw new Error('Categoría/división inválida');

  const localParsed = parseTeamNameAndDirectScore(lines, 'Equipo local', 'Equipo visitante', 'local');
  const visitanteParsed = parseTeamNameAndDirectScore(lines, 'Equipo visitante', 'Nº Local G TAm 2 TR TAz', 'visitante');
  const periodTotals = parsePeriodTotals(flat);

  let golesLocal = localParsed.goles;
  let golesVisitante = visitanteParsed.goles;

  if (golesLocal === null && periodTotals[0]) golesLocal = scoreFromPeriods(periodTotals[0], 'local');
  if (golesVisitante === null && periodTotals[1]) golesVisitante = scoreFromPeriods(periodTotals[1], 'visitante');

  if (golesLocal === null) throw new Error('No se pudo extraer el marcador local de forma independiente');
  if (golesVisitante === null) throw new Error('No se pudo extraer el marcador visitante de forma independiente');

  const local = { nombre: localParsed.nombre, goles: golesLocal };
  const visitante = { nombre: visitanteParsed.nombre, goles: golesVisitante };

  const jugadoresLocal = parsePlayerSection(lines, 'Nº Local G TAm 2 TR TAz', 'Nº Visitante G TAm 2 TR TAz');
  const jugadoresVisitante = parsePlayerSection(lines, 'Nº Visitante G TAm 2 TR TAz', 'Arbitros');

  const golesLocalJugadores = sum(jugadoresLocal, 'goles');
  const golesVisitanteJugadores = sum(jugadoresVisitante, 'goles');

  if (golesLocalJugadores !== local.goles) {
    throw new Error(`Goles local no cierran: marcador=${local.goles}, jugadores=${golesLocalJugadores}`);
  }
  if (golesVisitanteJugadores !== visitante.goles) {
    throw new Error(`Goles visitante no cierran: marcador=${visitante.goles}, jugadores=${golesVisitanteJugadores}`);
  }

  return {
    fecha,
    hora,
    categoria: scopeParts[0].trim(),
    division: scopeParts[1].trim(),
    local,
    visitante,
    jugadores_local: jugadoresLocal,
    jugadores_visitante: jugadoresVisitante,
    resumen: {
      jugadores: jugadoresLocal.length + jugadoresVisitante.length,
      goles: local.goles + visitante.goles,
      amarillas: sum(jugadoresLocal, 'tarjeta_amarilla') + sum(jugadoresVisitante, 'tarjeta_amarilla'),
      exclusiones_2min: sum(jugadoresLocal, 'exclusiones_2min') + sum(jugadoresVisitante, 'exclusiones_2min'),
      rojas: sum(jugadoresLocal, 'tarjeta_roja') + sum(jugadoresVisitante, 'tarjeta_roja'),
      azules: sum(jugadoresLocal, 'tarjeta_azul') + sum(jugadoresVisitante, 'tarjeta_azul'),
    },
    diagnostico: {
      marcador_local_metodo: localParsed.goles !== null
        ? localParsed.metodo
        : 'parciales_PT_ST_PTE_STE',
      marcador_visitante_metodo: visitanteParsed.goles !== null
        ? visitanteParsed.metodo
        : 'parciales_PT_ST_PTE_STE',
      parciales_detectados: periodTotals,
    },
  };
}
