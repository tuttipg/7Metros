import { LOCALE, TIMEZONE } from './config.js';

export function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

export function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || '7M';
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function unique(values) {
  return [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))];
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function formatDateISO(iso, options = {}) {
  if (!iso) return 'Fecha a confirmar';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE, ...options
  }).format(date).replace('.', '');
}

export function formatShortDate(iso) {
  if (!iso) return { day: '--', month: '---' };
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { day: '--', month: '---' };
  return {
    day: new Intl.DateTimeFormat(LOCALE, { day: '2-digit', timeZone: TIMEZONE }).format(date),
    month: new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: TIMEZONE }).format(date).replace('.', '').toUpperCase()
  };
}

export function currentDateLabel() {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: TIMEZONE
  }).format(new Date());
}

export function localISODate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIMEZONE
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function formatTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

export function safeHttpUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function field(row, names, fallback = null) {
  for (const name of names) {
    if (row && Object.prototype.hasOwnProperty.call(row, name) && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  return fallback;
}

export function numericField(row, names) {
  const value = field(row, names, null);
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function metric(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function ratio(numerator, denominator, digits = 1) {
  const d = Number(denominator);
  if (!d) return null;
  return Number((Number(numerator || 0) / d).toFixed(digits));
}

export function ageFromBirthDate(value, referenceDate = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match || !(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) return null;

  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  const birthCheck = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));
  if (
    birthCheck.getUTCFullYear() !== birthYear ||
    birthCheck.getUTCMonth() + 1 !== birthMonth ||
    birthCheck.getUTCDate() !== birthDay
  ) return null;

  const [currentYear, currentMonth, currentDay] = localISODate(referenceDate).split('-').map(Number);
  let age = currentYear - birthYear;
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) age -= 1;
  return age >= 0 && age < 100 ? age : null;
}

export function csvCell(value) {
  const text = String(value ?? '');
  const spreadsheetFormula = typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(text);
  const safeText = spreadsheetFormula ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function csvDownload(rows, filename) {
  const csv = rows
    .map(row => row.map(csvCell).join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function bySpanishName(a, b) {
  return String(a || '').localeCompare(String(b || ''), LOCALE, { sensitivity: 'base' });
}

export function plural(value, singular, pluralForm = `${singular}s`) {
  return `${value} ${Number(value) === 1 ? singular : pluralForm}`;
}