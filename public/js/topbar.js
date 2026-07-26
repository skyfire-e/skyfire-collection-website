import { API, thumbUrl } from './api.js';

function buildNavTree(cats) {
  const tree = [{ label: 'Home', href: '/', icon: '🏠' }];
  for (const [sectionId, section] of Object.entries(cats)) {
    tree.push({ label: section.label, href: '/' + sectionId, icon: sectionId === 'dice' ? '🎲' : '⚔️', section: true });
    for (const cat of (section.subcategories || [])) {
      if (cat.type === 'group' && cat.subcategories) {
        tree.push({ label: cat.label, href: '/' + sectionId + '/' + cat.id, sub: true, section: true });
        for (const sc of cat.subcategories) {
          tree.push({ label: sc.label, href: '/gallery?section=' + encodeURIComponent(sectionId) + '&category=' + encodeURIComponent(sc.id), subSub: true });
        }
      } else {
        tree.push({ label: cat.label, href: '/gallery?section=' + encodeURIComponent(sectionId) + '&category=' + encodeURIComponent(cat.id), sub: true });
      }
    }
  }
  tree.push({ divider: true });
  tree.push({ label: 'Spreadsheet', href: '/spreadsheet', icon: '📊' });
  return tree;
}

function renderNavDrawer() {
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('navDrawerOverlay');
  if (!drawer) return;

  API.get('/api/categories').then(cats => {
    const tree = buildNavTree(cats);
    const currentPath = location.pathname + location.search;
    drawer.innerHTML = '';
    for (const item of tree) {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'nav-divider';
        drawer.appendChild(div);
        continue;
      }
      const a = document.createElement('a');
      a.href = item.href;
      const cls = [item.section ? 'nav-section' : '', item.sub ? 'nav-sub' : '', item.subSub ? 'nav-sub-sub' : ''].filter(Boolean).join(' ');
      const isCurrent = (item.href === '/' && currentPath === '/') || (item.href !== '/' && currentPath.startsWith(item.href));
      a.className = cls + (isCurrent ? ' nav-current' : '');
      a.textContent = (item.icon ? item.icon + ' ' : '') + item.label;
      drawer.appendChild(a);
    }
  }).catch(e => { console.warn('Nav drawer categories load failed:', e); });
}

function openNavDrawer() {
  document.getElementById('navDrawer').classList.add('open');
  document.getElementById('navDrawerOverlay').classList.add('open');
}
function closeNavDrawer() {
  document.getElementById('navDrawer').classList.remove('open');
  document.getElementById('navDrawerOverlay').classList.remove('open');
}

function openSearch() {
  document.getElementById('searchModal').classList.add('open');
  setTimeout(() => document.getElementById('searchInput').focus(), 100);
}
function closeSearch() {
  document.getElementById('searchModal').classList.remove('open');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
}

let searchTimer;
function doSearch(query) {
  clearTimeout(searchTimer);
  if (!query.trim()) { document.getElementById('searchResults').innerHTML = ''; return; }
  searchTimer = setTimeout(async () => {
    try {
      const data = await API.get('/api/items?q=' + encodeURIComponent(query) + '&limit=50');
      const items = data.items || data;
      const container = document.getElementById('searchResults');
      if (items.length === 0) { container.innerHTML = '<p class="empty-state-sm">No results</p>'; return; }
      container.innerHTML = '';
      const countInfo = document.createElement('div');
      countInfo.className = 'sr-count-info';
      countInfo.textContent = items.length + ' result' + (items.length !== 1 ? 's' : '');
      container.appendChild(countInfo);
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-result';
        div.dataset.itemId = item.id;
        div.dataset.section = item.section;
        div.dataset.category = item.category;
        const img = document.createElement('img');
        img.src = thumbUrl(item.image) || '/images/default.svg';
        img.onerror = function() { this.src = '/images/default.svg'; };
        div.appendChild(img);
        const info = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'sr-title';
        title.textContent = item.title;
        info.appendChild(title);
        const cat = document.createElement('div');
        cat.className = 'sr-cat';
        cat.textContent = (item.sectionLabel || item.section) + ' / ' + (item.categoryLabel || item.category);
        info.appendChild(cat);
        div.appendChild(info);
        div.addEventListener('click', () => {
          location.href = '/gallery?section=' + encodeURIComponent(item.section) + '&category=' + encodeURIComponent(item.category) + '#item-' + item.id;
        });
        container.appendChild(div);
      });
    } catch (err) {
      document.getElementById('searchResults').innerHTML = '<p class="empty-state-sm">Search failed</p>';
    }
  }, 200);
}

export function initTopbar() {
  const menuBtn = document.getElementById('menuBtn');
  const searchBtn = document.getElementById('searchBtn');
  const navOverlay = document.getElementById('navDrawerOverlay');
  const searchModal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');
  const searchClose = document.getElementById('searchClose');

  if (menuBtn) {
    menuBtn.addEventListener('click', openNavDrawer);
    renderNavDrawer();
  }
  if (navOverlay) navOverlay.addEventListener('click', closeNavDrawer);
  if (searchBtn) searchBtn.addEventListener('click', openSearch);
  if (searchModal) searchModal.addEventListener('click', (e) => { if (e.target === searchModal) closeSearch(); });
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchInput) searchInput.addEventListener('input', (e) => doSearch(e.target.value));
  function onTopbarKeydown(e) {
    if (e.key === 'Escape') { closeNavDrawer(); closeSearch(); }
  }
  document.addEventListener('keydown', onTopbarKeydown);
  window.addEventListener('beforeunload', () => document.removeEventListener('keydown', onTopbarKeydown), { once: true });
}
