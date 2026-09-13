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

const EXPECTED_BRANCH_BY_DIVISION = Object.freeze({
  'LHC Hipotecario Seguros': 'M',
  'LHD Hipotecario Seguros': 'F',
});

function analyzeProgrammingDates(text) {
  const pattern = /\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(20\d{2})\b/gi;
  const dates = new Set();
  let invalidDateLiteral = false;

  for (const match of String(text ?? '').matchAll(pattern)) {
    const month = MONTHS[match[2].toLowerCase()];
    const day = Number(match[1]);
    const year = Number(match[3]);
    if (!month || !Number.isInteger(day) || day < 1 || day > 31) {
      invalidDateLiteral = true;
      continue;
    }

    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarDate.getUTCFullYear() !== year
      || calendarDate.getUTCMonth() !== month - 1
      || calendarDate.getUTCDate() !== day
    ) {
      invalidDateLiteral = true;
      continue;
    }

    dates.add(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  return { dates: [...dates], invalidDateLiteral };
}

function normalizeLine(line) {
  return String(line ?? '').replace(/\s+/g, ' ').trim();
}

function isValidProgrammingTime(value) {
  const match = String(value ?? '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
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
  const dateAnalysis = analyzeProgrammingDates(rawText);
  const matchDate = dateAnalysis.dates.length === 1 && !dateAnalysis.invalidDateLiteral
    ? dateAnalysis.dates[0]
    : null;
  const errors = [];
  if (dateAnalysis.invalidDateLiteral || dateAnalysis.dates.length === 0) {
    errors.push({ stage: 'programming_parse', error: 'missing_or_invalid_programming_date' });
  } else if (dateAnalysis.dates.length > 1) {
    errors.push({
      stage: 'programming_parse',
      error: 'ambiguous_programming_dates',
      dates: dateAnalysis.dates,
    });
  }

  const candidates = [];

  // A match candidate without exactly one valid calendar date is not a stable identity.
  // Fail closed instead of assigning the first date found in a multi-date/reprogramming
  // document to every row, which could correlate a match with the wrong planilla.
  if (!matchDate) {
    return {
      safe: true,
      dry_run: true,
      write_enabled: false,
      auth_used: false,
      complete: false,
      source_url: canonicalSourceUrl,
      match_date: null,
      candidates,
      errors,
    };
  }

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

    if (!isValidProgrammingTime(prefix[1])) {
      errors.push({
        stage: 'programming_parse',
        error: 'invalid_programming_time',
        time: prefix[1],
        raw_line: line,
      });
      continue;
    }

    const expectedBranch = EXPECTED_BRANCH_BY_DIVISION[division];
    if (prefix[2] !== expectedBranch) {
      errors.push({
        stage: 'programming_parse',
        error: 'division_branch_mismatch',
        division,
        expected_branch: expectedBranch,
        actual_branch: prefix[2],
        raw_line: line,
      });
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
