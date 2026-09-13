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

export function extractTopDivisionProgrammingCandidates({ text, sourceUrl }) {
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

    candidates.push({
      date: matchDate,
      category: 'Mayores',
      division,
      time: prefix[1],
      branch: prefix[2],
      raw_matchup_and_officials: prefix[3],
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
