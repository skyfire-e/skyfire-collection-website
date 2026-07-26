import { API, checkAuth, isAdmin } from './api.js';

const PAGE_TYPE = document.body.dataset.pageType;
const grid = document.getElementById('categoryGrid');

if (PAGE_TYPE === 'section') {
  initSectionPage();
} else if (PAGE_TYPE === 'subgroup') {
  initSubgroupPage();
}

async function initSectionPage() {
  const sectionId = location.pathname.replace(/^\/|\/$/g, '');
  const titleEl = document.getElementById('pageTitle');
  const titleEl2 = document.getElementById('sectionTitle');

  try {
    const data = await API.get('/api/categories');
    const section = data[sectionId];
    if (!section) { grid.innerHTML = '<p class="empty-state">Section not found.</p>'; return; }
    if (titleEl) titleEl.textContent = section.label + ' - skyf1re Collection';
    if (titleEl2) titleEl2.textContent = section.label;

    section.subcategories.forEach(c => {
      const a = document.createElement('a');
      if (c.type === 'group') {
        a.href = '/' + sectionId + '/' + c.id;
      } else {
        a.href = '/gallery?section=' + sectionId + '&category=' + c.id;
      }
      a.className = 'category-btn' + (c.type === 'group' ? ' category-group' : '');
      a.textContent = c.label;
      grid.appendChild(a);
    });

    showAdminActions();
  } catch (err) {
    grid.innerHTML = '<p class="empty-state">Failed to load categories. Please refresh.</p>';
  }
}

async function initSubgroupPage() {
  const parts = location.pathname.replace(/\/$/g, '').split('/').filter(Boolean);
  const sectionId = parts[0];
  const groupId = parts[1];
  const titleEl = document.getElementById('pageTitle');
  const titleEl2 = document.getElementById('pageTitle2');
  const backLink = document.getElementById('backLink');

  try {
    const data = await API.get('/api/categories');
    const section = data[sectionId];
    if (!section) { grid.innerHTML = '<p class="empty-state">Section not found.</p>'; return; }
    const group = section.subcategories.find(c => c.id === groupId);
    if (!group || !group.subcategories) { grid.innerHTML = '<p class="empty-state">Group not found.</p>'; return; }

    if (titleEl) titleEl.textContent = group.label + ' - skyf1re Collection';
    if (titleEl2) titleEl2.textContent = group.label;
    if (backLink) {
      backLink.href = '/' + sectionId;
      backLink.textContent = '';
      const arrow = document.createElement('span');
      arrow.className = 'back-arrow';
      arrow.textContent = '\u2190';
      const text = document.createElement('span');
      text.className = 'back-text';
      text.textContent = 'Back to ' + section.label;
      backLink.appendChild(arrow);
      backLink.appendChild(text);
    }

    group.subcategories.forEach(c => {
      const a = document.createElement('a');
      a.href = '/gallery?section=' + sectionId + '&category=' + c.id;
      a.className = 'category-btn';
      a.textContent = c.label;
      grid.appendChild(a);
    });
  } catch (err) {
    grid.innerHTML = '<p class="empty-state">Failed to load categories. Please refresh.</p>';
  }
}

async function showAdminActions() {
  await checkAuth();
  if (isAdmin()) {
    const el = document.getElementById('adminActions');
    if (el) el.classList.remove('hidden');
  }
}
