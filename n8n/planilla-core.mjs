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

export function parseOfficialFemebalSheet(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('La planilla está vacía');
  const cleaned = text.replace(/\u00a0/g, ' ').replace(/\r/g, '');
  const lines = cleaned.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const flat = lines.join('\n');

  const fecha = requireMatch(flat, /(?:^|\n)Fecha:\s*\n?(\d{4}-\d{2}-\d{2})(?:\n|$)/i, 'fecha');
  const hora = requireMatch(flat, /(?:^|\n)Hora:\s*\n?(\d{2}:\d{2}:\d{2})(?:\n|$)/i, 'hora');
  const scope = requireMatch(flat, /(?:^|\n)Categoria\s*-\s*Division:\s*\n?([^\n]+)/i, 'categoría/división');
  const scopeParts = scope.split(/\s+-\s+/, 2);
  if (scopeParts.length !== 2) throw new Error('Categoría/división inválida');

  const localLine = requireMatch(flat, /(?:^|\n)Equipo local\s*\n([^\n]+)/i, 'equipo local');
  const visitorLine = requireMatch(flat, /(?:^|\n)Equipo visitante\s*\n([^\n]+)/i, 'equipo visitante');
  const teamScore = (line, label) => {
    const match = line.match(/^(.+?)\s+(\d+)$/);
    if (!match) throw new Error(`No se pudo extraer marcador de ${label}`);
    return { nombre: match[1].trim(), goles: Number(match[2]) };
  };

  const local = teamScore(localLine, 'local');
  const visitante = teamScore(visitorLine, 'visitante');
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
  };
}
