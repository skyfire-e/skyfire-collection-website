(function() {
  const stored = localStorage.getItem('theme');
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  }
})();

function injectNav() {
  const navBtns = document.createElement('div');
  navBtns.className = 'nav-corner';
  navBtns.innerHTML = `
    <button class="nav-corner-btn" id="menuBtn" title="Navigation">🧭</button>
    <button class="nav-corner-btn" id="searchBtn" title="Search">🔍</button>
  `;
  document.body.appendChild(navBtns);

  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'navDrawer';
  document.body.appendChild(drawer);

  const overlay = document.createElement('div');
  overlay.className = 'nav-drawer-overlay';
  overlay.id = 'navDrawerOverlay';
  document.body.appendChild(overlay);

  const searchModal = document.createElement('div');
  searchModal.className = 'search-modal';
  searchModal.id = 'searchModal';
  searchModal.innerHTML = `
    <div class="search-box">
      <div class="search-header">
        <input type="text" id="searchInput" placeholder="Search items...">
        <button class="nav-corner-btn" id="searchClose">×</button>
      </div>
      <div class="search-results" id="searchResults"></div>
    </div>
  `;
  document.body.appendChild(searchModal);
}

document.addEventListener('DOMContentLoaded', () => {
  injectNav();

  document.querySelectorAll('[data-href]').forEach(btn => {
    btn.addEventListener('click', () => { location.href = btn.dataset.href; });
  });

  fetch('/api/settings').then(r => r.json()).then(s => {
    const stored = localStorage.getItem('theme');
    const theme = stored || s.defaultTheme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (s.siteName) {
      document.title = s.siteName;
      const h1 = document.querySelector('h1');
      if (h1 && h1.closest('.home-page')) h1.textContent = s.siteName;
    }
  }).catch(() => {});

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }

  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn && !document.getElementById('authModal')) {
    adminBtn.addEventListener('click', () => { location.href = '/#login'; });
  }

  if (location.hash === '#login' && document.getElementById('authModal')) {
    document.getElementById('authModal').classList.add('open');
  }

  import('./topbar.js').then(m => m.initTopbar());
});
