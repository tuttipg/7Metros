// Núcleo puro y testeable para la lógica crítica del importador FEMEBAL.
// No depende de n8n ni escribe datos: sirve como referencia ejecutable para V9.

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateDiscoveryManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Manifest de descubrimiento inválido');
  if (manifest.schema_version !== 2) throw new Error(`schema_version no soportado: ${manifest.schema_version ?? 'ausente'}`);
  if (manifest.safe !== true) throw new Error('Manifest sin safe=true');
  if (manifest.complete !== true) throw new Error('Manifest incompleto: importación bloqueada');
  if (manifest.write_enabled !== false) throw new Error('Manifest no es read-only');
  if (manifest.auth_used !== false) throw new Error('Manifest usó autenticación');
  if (!Array.isArray(manifest.pages) || !Array.isArray(manifest.pdfs) || !Array.isArray(manifest.fetch_errors)) throw new Error('Manifest con colecciones inválidas');
  if (manifest.fetch_errors.length !== 0) throw new Error('Manifest declara errores de fetch');
  return { schema_version: 2, safe: true, complete: true, write_enabled: false, auth_used: false, page_count: manifest.pages.length, pdf_count: manifest.pdfs.length };
}

function requiredText(fixture, field) {
  const value = String(fixture?.[field] ?? '').trim();
  if (!value) throw new Error(`Fixture sin ${field}`);
  return value;
}

function teamCode(value) {
  const code = String(value ?? 'A').trim().toUpperCase();
  if (!code) throw new Error('Fixture sin equipo_codigo');
  return code;
}

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function fixtureScopeKey(fixture) {
  const categoria = requiredText(fixture, 'categoria');
  const division = requiredText(fixture, 'division');
  const rama = requiredText(fixture, 'rama').toUpperCase();
  if (!['M', 'F'].includes(rama)) throw new Error(`Rama inválida: ${rama}`);
  const localId = positiveId(fixture?.local_equipo_id);
  const visitanteId = positiveId(fixture?.visitante_equipo_id);
  if (localId || visitanteId) {
    if (!localId || !visitanteId) throw new Error('Fixture con un solo equipo_id resuelto');
    if (localId === visitanteId) throw new Error('Local y visitante no pueden ser el mismo equipo');
    return `ids|${localId}|${visitanteId}`;
  }
  const local = normalizeText(requiredText(fixture, 'local'));
  const visitante = normalizeText(requiredText(fixture, 'visitante'));
  if (!local || !visitante || local === visitante) throw new Error('Clubes local/visitante inválidos');
  return ['scope', rama, normalizeText(categoria), normalizeText(division), local, teamCode(fixture?.local_equipo_codigo), visitante, teamCode(fixture?.visitante_equipo_codigo)].join('|');
}

export function scheduleKey(fixture) {
  const fecha = requiredText(fixture, 'fecha');
  const hora = String(fixture?.hora ?? '').trim().slice(0, 5);
  return `${fecha}|${hora || 'sin-hora'}`;
}

function sourceType(fixture) {
  const type = requiredText(fixture, 'tipo_fuente');
  if (!['fecha_normal', 'reprogramacion'].includes(type)) throw new Error(`tipo_fuente inválido: ${type}`);
  return type;
}

function uniqueBySchedule(items) {
  const map = new Map();
  for (const item of items) { const key = scheduleKey(item); if (!map.has(key)) map.set(key, item); }
  return [...map.values()];
}

export function prioritizeFixtureSchedules(fixtures) {
  if (!Array.isArray(fixtures)) throw new Error('fixtures debe ser un array');
  const groups = new Map();
  fixtures.forEach((fixture, index) => {
    const scope = fixtureScopeKey(fixture); sourceType(fixture); scheduleKey(fixture);
    if (!groups.has(scope)) groups.set(scope, []);
    groups.get(scope).push({ ...fixture, __index: index });
  });
  const selected = []; const ambiguous = [];
  for (const [scope, rows] of groups) {
    const normal = uniqueBySchedule(rows.filter(row => sourceType(row) === 'fecha_normal'));
    const rescheduled = uniqueBySchedule(rows.filter(row => sourceType(row) === 'reprogramacion'));
    if (rescheduled.length === 1) {
      const chosen = { ...rescheduled[0] }; delete chosen.__index;
      selected.push({ ...chosen, fuente_priorizada: 'reprogramacion', versiones_detectadas: rows.length, fecha_programacion_original: normal.length === 1 ? normal[0].fecha : null, hora_programacion_original: normal.length === 1 ? normal[0].hora ?? null : null });
      continue;
    }
    if (rescheduled.length > 1) { ambiguous.push({ scope, tipo: 'multiples_reprogramaciones', versiones: rows.map(stripInternal) }); continue; }
    if (normal.length === 1) {
      const chosen = { ...normal[0] }; delete chosen.__index;
      selected.push({ ...chosen, fuente_priorizada: 'fecha_normal', versiones_detectadas: rows.length, fecha_programacion_original: null, hora_programacion_original: null });
      continue;
    }
    if (normal.length > 1) ambiguous.push({ scope, tipo: 'mismo_cruce_repetido', versiones: rows.map(stripInternal) });
  }
  return { selected, ambiguous };
}

function stripInternal(row) { const copy = { ...row }; delete copy.__index; return copy; }
