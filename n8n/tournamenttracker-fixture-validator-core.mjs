import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

function normalizeIdentity(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} inválido`);
  return value.trim();
}

function requireIsoDate(value, label) {
  const date = requireNonEmptyString(value, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`${label} debe usar YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${label} no es una fecha calendario válida`);
  }
  return date;
}

function requireScore(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} inválido`);
  return value;
}

function validateExpected(expected) {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) throw new Error('Partido esperado inválido');
  return {
    fecha: requireIsoDate(expected.fecha, 'Fecha esperada'),
    local: requireNonEmptyString(expected.local, 'Equipo local esperado'),
    visitante: requireNonEmptyString(expected.visitante, 'Equipo visitante esperado'),
    goles_local: requireScore(expected.goles_local, 'Marcador local esperado'),
    goles_visitante: requireScore(expected.goles_visitante, 'Marcador visitante esperado'),
  };
}

function validatePlanilla(planilla, matchIndex, sheetIndex) {
  if (!planilla || typeof planilla !== 'object' || Array.isArray(planilla)) throw new Error(`Planilla inválida en partido ${matchIndex}, índice ${sheetIndex}`);
  if (typeof planilla.pdf !== 'string' || !planilla.pdf.trim()) throw new Error(`Planilla sin pdf explícito en partido ${matchIndex}, índice ${sheetIndex}`);
  return { ...planilla, pdf: canonicalizeOfficialFemebalUrl(planilla.pdf, { pdf: true }) };
}

function validateMatch(match, index) {
  if (!match || typeof match !== 'object' || Array.isArray(match)) throw new Error(`Partido ${index} inválido`);
  const planillas = match.planillas;
  if (!Array.isArray(planillas)) throw new Error(`planillas debe ser array en partido ${index}`);
  return {
    ...match,
    fecha: requireIsoDate(match.fecha, `Fecha de partido ${index}`),
    local: requireNonEmptyString(match.local, `Local de partido ${index}`),
    visitante: requireNonEmptyString(match.visitante, `Visitante de partido ${index}`),
    goles_local: requireScore(match.goles_local, `Marcador local de partido ${index}`),
    goles_visitante: requireScore(match.goles_visitante, `Marcador visitante de partido ${index}`),
    planillas: planillas.map((sheet, sheetIndex) => validatePlanilla(sheet, index, sheetIndex)),
  };
}

export function validateTournamentTrackerFixtureOffline({ fixture, expected }) {
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new Error('Fixture TournamentTracker inválido');
  if (fixture.source !== 'tournamenttracker_offline_fixture') throw new Error('source del fixture inválido');
  if (fixture.network_used !== false) throw new Error('El validador offline exige network_used=false');
  if (fixture.auth_used !== false) throw new Error('El fixture no puede usar autenticación');
  if (fixture.write_enabled !== false) throw new Error('El fixture no puede habilitar escritura');
  if (!Array.isArray(fixture.partidos)) throw new Error('partidos debe ser array');

  const wanted = validateExpected(expected);
  const matches = fixture.partidos.map(validateMatch).filter(match =>
    match.fecha === wanted.fecha
    && normalizeIdentity(match.local) === normalizeIdentity(wanted.local)
    && normalizeIdentity(match.visitante) === normalizeIdentity(wanted.visitante)
    && match.goles_local === wanted.goles_local
    && match.goles_visitante === wanted.goles_visitante
  );

  if (matches.length === 0) throw new Error('No existe coincidencia exacta para el partido esperado');
  if (matches.length > 1) throw new Error('Coincidencia ambigua para el partido esperado');
  const match = matches[0];
  if (match.planillas.length === 0) throw new Error('El partido esperado no tiene planilla PDF explícita');
  if (match.planillas.length > 1) throw new Error('El partido esperado tiene múltiples planillas PDF; requiere selección explícita');

  return {
    dry_run: true,
    network_used: false,
    auth_used: false,
    write_enabled: false,
    expected_match_checked: true,
    expected_match: wanted,
    match,
    pdf_url: match.planillas[0].pdf,
  };
}
