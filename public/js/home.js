// Home page: render one button per section from the DB (U5).
// The static markup in index.html stays as a fallback — it is only replaced
// after /api/categories responds successfully, so an API failure or slow
// network never leaves the page without navigation.
import { API } from './api.js';

const ICONS = { dice: '\u{1F3B2}', miniatures: '\u2694\uFE0F' };
const FALLBACK_ICON = '\u{1F4E6}';

document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('homeButtons');
  if (!wrap) return;
  API.get('/api/categories').then(cats => {
    const entries = Object.entries(cats);
    if (entries.length === 0) return; // keep the static fallback
    wrap.textContent = '';
    for (const [id, sec] of entries) {
      const a = document.createElement('a');
      a.href = '/' + encodeURIComponent(id);
      a.className = 'home-btn';
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = ICONS[id] || FALLBACK_ICON;
      a.appendChild(icon);
      a.appendChild(document.createTextNode(' ' + sec.label));
      wrap.appendChild(a);
    }
  }).catch(e => console.warn('Home sections load failed:', e));
});
