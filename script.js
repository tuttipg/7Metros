import { loadData, state } from './js/store.js';
import {
  renderShell, renderLoadingStatus, renderSuccessStatus, renderErrorStatus,
  renderCompetitionBar, initSettingsPage, initReports, showToast
} from './js/ui.js';
import { renderCurrentPage } from './js/pages.js';

async function boot() {
  renderShell();
  initSettingsPage();
  initReports();
  renderLoadingStatus();
  document.body.setAttribute('aria-busy', 'true');

  try {
    await loadData();
    renderCompetitionBar();
    renderCurrentPage();
    renderSuccessStatus();
  } catch (error) {
    console.error('7Metros: error cargando datos', error);
    renderErrorStatus(error);
  } finally {
    document.body.removeAttribute('aria-busy');
  }
}

document.addEventListener('7m:filters-changed', () => {
  if (!state.loaded) return;
  renderCurrentPage();
  showToast('Filtros actualizados.');
});

boot();
