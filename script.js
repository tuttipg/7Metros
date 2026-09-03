// =========================================
// 7METROS — script.js
// Comportamiento de interfaz (sin backend todavía)
// =========================================

document.addEventListener('DOMContentLoaded', () => {

  // --- Menú lateral en móvil ---
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  }

  menuToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  overlay.addEventListener('click', closeSidebar);

  // Cerrar el menú al elegir una sección en móvil
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // La navegación real todavía no está conectada a otras páginas
      e.preventDefault();

      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      if (!item.classList.contains('nav-disabled')) {
        item.classList.add('active');
      }

      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  // --- Selector de torneo (placeholder, sin datos reales todavía) ---
  const tournamentSelect = document.getElementById('tournamentSelect');
  tournamentSelect.addEventListener('change', () => {
    console.log('Torneo seleccionado:', tournamentSelect.value);
    // Acá luego se recargarán los datos reales según el torneo elegido
  });

  // --- Fecha actual dinámica ---
  const todayDateEl = document.getElementById('todayDate');
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const hoy = new Date();
  todayDateEl.textContent = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  // --- Accesos rápidos (placeholders) ---
  document.querySelectorAll('.quick-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.querySelector('span:last-child').textContent;
      alert(`Próximamente: "${label}" se conectará a la base de datos real.`);
    });
  });

  // --- Botones del último partido (placeholders) ---
  document.querySelectorAll('.btn-ghost').forEach(btn => {
    btn.addEventListener('click', () => {
      alert(`Próximamente: "${btn.textContent.trim()}" abrirá la información real del partido.`);
    });
  });

});
