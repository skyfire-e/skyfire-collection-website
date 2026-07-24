(function() {
  const stored = localStorage.getItem('theme');
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  }
})();

document.addEventListener('DOMContentLoaded', () => {
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
      if (h1) h1.textContent = s.siteName;
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
});
