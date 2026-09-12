import { state } from './store.js';
import { localISODate } from './utils.js';
import { matchUiStatus } from './match-freshness-core.mjs';

function matchIdFromHref(href) {
  try {
    const url = new URL(href, location.href);
    if (!url.pathname.endsWith('/partido.html') && !url.pathname.endsWith('partido.html')) return null;
    const id = Number(url.searchParams.get('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function pendingIds(today) {
  return new Set(state.matches
    .filter(match => matchUiStatus(match, today).code === 'result-pending')
    .map(match => Number(match.id)));
}

function decorateMatchCard(anchor, pending) {
  const row = anchor.closest('.match-row');
  if (row) {
    const label = row.querySelector('.result small');
    if (label) label.textContent = 'RESULTADO PENDIENTE';
    row.dataset.resultPending = 'true';
    return;
  }

  const compact = anchor.closest('.compact-match');
  if (compact) {
    const score = compact.querySelector('strong');
    if (score) {
      score.textContent = 'Pendiente';
      score.title = 'Resultado todavía no importado';
    }
    compact.dataset.resultPending = 'true';
    return;
  }

  const tableRow = anchor.closest('tr');
  if (tableRow) {
    [...tableRow.querySelectorAll('td')].forEach(cell => {
      if (cell.textContent.trim() === 'Programado') cell.textContent = 'Resultado pendiente';
    });
    tableRow.dataset.resultPending = 'true';
  }
}

export function enhanceMatchFreshness() {
  if (!state.loaded) return;
  const today = localISODate();
  const pending = pendingIds(today);
  if (!pending.size) return;

  document.querySelectorAll('a[href*="partido.html?id="]').forEach(anchor => {
    const id = matchIdFromHref(anchor.getAttribute('href'));
    if (id && pending.has(id)) decorateMatchCard(anchor, pending);
  });

  const detail = document.getElementById('match-detail');
  if (detail) {
    const currentId = Number(new URLSearchParams(location.search).get('id'));
    if (pending.has(currentId)) {
      const pill = detail.querySelector('.status-pill');
      if (pill) {
        pill.textContent = 'RESULTADO PENDIENTE';
        pill.classList.add('gold');
        pill.title = 'La fecha ya pasó, pero el resultado todavía no fue importado.';
      }
      detail.dataset.resultPending = 'true';
    }
  }
}
