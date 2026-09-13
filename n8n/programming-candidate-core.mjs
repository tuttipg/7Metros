import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

const MONTHS = Object.freeze({
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
});

const TOP_DIVISIONS = Object.freeze([
  'LHC Hipotecario Seguros',
  'LHD Hipotecario Seguros',
]);

function isoDateFromProgrammingText(text) {
  const match = String(text ?? '').match(/\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(20\d{2})\b/i);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  const day = Number(match[1]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeLine(line) {
  return String(line ?? '').replace(/\s+/g, ' ').trim();
}

function assertProgrammingPdfUrl(sourceUrl) {
  const canonical = canonicalizeOfficialFemebalUrl(sourceUrl, { pdf: true });
  const url = new URL(canonical);
  if (!['femebal.com', 'www.femebal.com'].includes(url.hostname) || !url.pathname.startsWith('/wp-content/uploads/')) {
    throw new Error('La fuente debe ser un PDF oficial de programación FEMEBAL');
  }
  return canonical;
}

function catalogAliases(clubCatalog) {
  const aliases = [];
  for (const club of Array.isArray(clubCatalog) ? clubCatalog : []) {
    if (!club || club.id == null || !normalizeLine(club.name)) continue;
    const values = [club.name, ...(Array.isArray(club.aliases) ? club.aliases : [])];
    for (const value of values) {
      const alias = normalizeLine(value);
      if (!alias) continue;
      aliases.push({ id: club.id, name: normalizeLine(club.name), alias });
    }
  }
  return aliases.sort((a, b) => b.alias.length - a.alias.length || String(a.id).localeCompare(String(b.id)));
}

function consumeAlias(text, alias) {
  if (text === alias) return '';
  if (!text.startsWith(`${alias} `)) return null;
  return text.slice(alias.length).trimStart();
}

export function resolveProgrammingTeams(rawMatchupAndOfficials, clubCatalog) {
  const raw = normalizeLine(rawMatchupAndOfficials);
  const aliases = catalogAliases(clubCatalog);
  if (!raw || aliases.length === 0) {
    return { status: 'unresolved', reason: 'catalog_unavailable_or_empty' };
  }

  // Multiple aliases for the same club pair are not ambiguity. Keep the most
  // specific (longest) alias combination for each pair, then detect ambiguity
  // only when distinct club IDs can explain the same raw row exactly.
  const matchesByPair = new Map();
  for (const local of aliases) {
    const afterLocal = consumeAlias(raw, local.alias);
    if (afterLocal == null) continue;

    for (const visitor of aliases) {
      if (String(visitor.id) === String(local.id)) continue;
      const trailing = consumeAlias(afterLocal, visitor.alias);
      if (trailing == null) continue;

      const pairKey = `${String(local.id)}\u0000${String(visitor.id)}`;
      const score = local.alias.length + visitor.alias.length;
      const previous = matchesByPair.get(pairKey);
      if (previous && previous.score >= score) continue;
      matchesByPair.set(pairKey, {
        score,
        local: { id: local.id, name: local.name, matched_alias: local.alias },
        visitor: { id: visitor.id, name: visitor.name, matched_alias: visitor.alias },
        trailing_officials: trailing || null,
      });
    }
  }

  const matches = [...matchesByPair.values()].map(({ score: _score, ...match }) => match);
  if (matches.length === 1) return { status: 'resolved', ...matches[0] };
  if (matches.length === 0) return { status: 'unresolved', reason: 'no_exact_catalog_match' };
  return { status: 'ambiguous', reason: 'multiple_exact_catalog_matches', match_count: matches.length };
}

export function extractTopDivisionProgrammingCandidates({ text, sourceUrl, clubCatalog = [] }) {
  const canonicalSourceUrl = assertProgrammingPdfUrl(sourceUrl);
  const rawText = String(text ?? '');
  const matchDate = isoDateFromProgrammingText(rawText);
  const errors = [];
  if (!matchDate) errors.push({ stage: 'programming_parse', error: 'missing_or_invalid_programming_date' });

  const candidates = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    if (!line.startsWith('Mayores ')) continue;

    const division = TOP_DIVISIONS.find((value) => line.startsWith(`Mayores ${value} `));
    if (!division) continue;

    const rest = line.slice(`Mayores ${division} `.length);
    const prefix = rest.match(/^(\d{2}:\d{2})\s+([MF])\s+(.+)$/);
    if (!prefix) {
      errors.push({ stage: 'programming_parse', error: 'malformed_top_division_row', raw_line: line });
      continue;
    }

    const rawMatchupAndOfficials = prefix[3];
    candidates.push({
      date: matchDate,
      category: 'Mayores',
      division,
      time: prefix[1],
      branch: prefix[2],
      raw_matchup_and_officials: rawMatchupAndOfficials,
      team_resolution: resolveProgrammingTeams(rawMatchupAndOfficials, clubCatalog),
      raw_line: line,
      source_url: canonicalSourceUrl,
      source_kind: 'official_programming_pdf',
    });
  }

  return {
    safe: true,
    dry_run: true,
    write_enabled: false,
    auth_used: false,
    complete: errors.length === 0,
    source_url: canonicalSourceUrl,
    match_date: matchDate,
    candidates,
    errors,
  };
}
