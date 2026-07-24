document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-href]').forEach(btn => {
    btn.addEventListener('click', () => { location.href = btn.dataset.href; });
  });
});

if (document.querySelector('.home-page')) {
  fetch('/api/settings').then(r => r.json()).then(s => {
    if (s.siteName) { document.title = s.siteName; document.querySelector('h1').textContent = s.siteName; }
  }).catch(() => {});
}
