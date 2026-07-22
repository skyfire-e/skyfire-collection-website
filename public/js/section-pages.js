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

  const data = await API.get('/api/categories');
  const section = data[sectionId];
  if (!section) return;
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
}

async function initSubgroupPage() {
  const parts = location.pathname.replace(/\/$/g, '').split('/').filter(Boolean);
  const sectionId = parts[0];
  const groupId = parts.length === 3 ? parts[2] : parts[1];
  const titleEl = document.getElementById('pageTitle');
  const titleEl2 = document.getElementById('pageTitle2');
  const backLink = document.getElementById('backLink');

  const data = await API.get('/api/categories');
  const section = data[sectionId];
  if (!section) return;
  const group = section.subcategories.find(c => c.id === groupId);
  if (!group || !group.subcategories) return;

  if (titleEl) titleEl.textContent = group.label + ' - skyf1re Collection';
  if (titleEl2) titleEl2.textContent = group.label;
  if (backLink) { backLink.href = '/' + sectionId; backLink.innerHTML = '&larr; Back to ' + section.label; }

  group.subcategories.forEach(c => {
    const a = document.createElement('a');
    a.href = '/gallery?section=' + sectionId + '&category=' + c.id;
    a.className = 'category-btn';
    a.textContent = c.label;
    grid.appendChild(a);
  });
}

async function showAdminActions() {
  await checkAuth();
  if (isAdmin()) {
    const el = document.getElementById('adminActions');
    if (el) el.style.display = 'flex';
  }
}
