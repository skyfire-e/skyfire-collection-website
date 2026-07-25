(function() {
  const stored = localStorage.getItem('theme');
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  }
})();

function injectTopbar() {
  const topbar = document.createElement('div');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <button class="topbar-btn" id="menuBtn" title="Navigation">☰</button>
    <button class="topbar-btn" id="searchBtn" title="Search">🔍</button>
    <div class="topbar-spacer"></div>
    <a href="/" class="topbar-btn" title="Home">🏠</a>
  `;
  document.body.prepend(topbar);

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
      <div class="btn-row" style="justify-content:space-between;margin-top:0">
        <input type="text" id="searchInput" placeholder="Search items...">
        <button class="topbar-btn" id="searchClose">×</button>
      </div>
      <div class="search-results" id="searchResults"></div>
    </div>
  `;
  document.body.appendChild(searchModal);
}

document.addEventListener('DOMContentLoaded', () => {
  injectTopbar();

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
