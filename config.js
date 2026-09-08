const raw = window.SEVEN_METROS_CONFIG || {};

export const CONFIG = raw;
export const SEASON_ID = Number(raw.seasonId || 3);
export const SEASON_LABEL = raw.seasonLabel || 'CLAUSURA 2026';
export const LOCALE = raw.locale || 'es-AR';
export const TIMEZONE = raw.timezone || 'America/Argentina/Buenos_Aires';
export const DEFAULT_FILTERS = Object.freeze({
  categoria: raw.defaults?.categoria || 'Mayores',
  division: raw.defaults?.division || 'LHC Hipotecario Seguros',
  rama: raw.defaults?.rama || 'M'
});

export const STORAGE_KEYS = Object.freeze({
  categoria: '7m_categoria',
  division: '7m_division',
  rama: '7m_rama',
  rememberFilters: '7m_setting_filters',
  compact: '7m_setting_compact',
  motion: '7m_setting_motion'
});
