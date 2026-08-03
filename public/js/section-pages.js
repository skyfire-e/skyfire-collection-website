import { API, checkAuth, isAdmin } from './api.js';
import { showToast } from './toast.js';
import { createReorderDnd, createSwapArrows } from './dnd.js';

let grid;
let dnd = null;
let swapArrows = null;

document.addEventListener('DOMContentLoaded', () => {
  grid = document.getElementById('categoryGrid');
  if (grid) dnd = createReorderDnd(grid, '.category-btn');
  if (grid) swapArrows = createSwapArrows(grid, '.category-btn');
  const pageType = document.body.dataset.pageType;
  if (pageType === 'section') {
    initSectionPage();
  } else if (pageType === 'subgroup') {
    initSubgroupPage();
  }
});

function renderCategoryButton(sectionId, c) {
  const a = document.createElement('a');
  if (c.type === 'group') {
    a.href = '/' + encodeURIComponent(sectionId) + '/' + encodeURIComponent(c.id);
  } else {
    a.href = '/gallery?section=' + encodeURIComponent(sectionId) + '&category=' + encodeURIComponent(c.id);
  }
  a.className = 'category-btn' + (c.type === 'group' ? ' category-group' : '');
  a.dataset.catId = c.id;
  a.textContent = c.label;
  // In reorder mode links must not navigate
  a.addEventListener('click', (e) => {
    if (reorderMode) e.preventDefault();
  });
  return a;
}

async function initSectionPage() {
  const sectionId = location.pathname.replace(/^\/|\/$/g, '');
  const titleEl = document.getElementById('pageTitle');
  const titleEl2 = document.getElementById('sectionTitle');

  try {
    const data = await API.get('/api/categories');
    const section = data[sectionId];
    if (!section) {
      grid.innerHTML = '<p class="empty-state">Section not found.</p>';
      return;
    }
    if (titleEl) titleEl.textContent = section.label + ' - skyfire Collection';
    if (titleEl2) titleEl2.textContent = section.label;

    section.subcategories.forEach((c) => grid.appendChild(renderCategoryButton(sectionId, c)));

    showAdminActions({ section: sectionId, parentId: null });
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
    if (!section) {
      grid.innerHTML = '<p class="empty-state">Section not found.</p>';
      return;
    }
    const group = section.subcategories.find((c) => c.id === groupId);
    if (!group || !group.subcategories) {
      grid.innerHTML = '<p class="empty-state">Group not found.</p>';
      return;
    }

    if (titleEl) titleEl.textContent = group.label + ' - skyfire Collection';
    if (titleEl2) titleEl2.textContent = group.label;
    if (backLink) {
      backLink.href = '/' + encodeURIComponent(sectionId);
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

    group.subcategories.forEach((c) => grid.appendChild(renderCategoryButton(sectionId, c)));

    // Items filed at this group's own root are rendered by gallery-page.js into
    // #subgroupItemsGrid — a full gallery (lightbox, edit, delete), not a link preview.

    showAdminActions({ section: sectionId, parentId: groupId });
  } catch (err) {
    grid.innerHTML = '<p class="empty-state">Failed to load categories. Please refresh.</p>';
  }
}

async function showAdminActions(reorderCtx) {
  await checkAuth();
  if (!isAdmin()) return;
  const el = document.getElementById('adminActions');
  if (el) el.classList.remove('hidden');

  if (reorderCtx && grid && grid.querySelectorAll('.category-btn').length > 1) {
    const reorderBtn = document.createElement('button');
    reorderBtn.className = 'nav-corner-btn reorder-corner-btn';
    reorderBtn.id = 'reorderBtn';
    reorderBtn.title = 'Re-arrange categories';
    reorderBtn.setAttribute('aria-label', 'Re-arrange categories');
    reorderBtn.textContent = '\u{1F500}';
    document.body.appendChild(reorderBtn);
    reorderBtn.addEventListener('click', () => toggleReorder(reorderCtx));
  }
}

// --- Category re-arrange (mirrors gallery item reorder) ---
let reorderMode = false;

async function toggleReorder(ctx) {
  const btn = document.getElementById('reorderBtn');
  if (reorderMode) {
    try {
      await saveReorder(ctx);
    } catch (err) {
      showToast('Failed to save order: ' + (err.message || 'Unknown error'), 'error');
      return;
    }
    btn.textContent = '🔀';
    btn.title = 'Re-arrange categories';
    btn.classList.remove('btn-success');
    grid.classList.remove('reorder-mode');
    dnd.disable();
    swapArrows.disable();
    reorderMode = false;
    showToast('Category order saved', 'success');
  } else {
    reorderMode = true;
    // Icon-only label: the button is a 48px circle, text does not fit
    btn.textContent = '\u2713';
    btn.title = 'Done — save order';
    btn.classList.add('btn-success');
    grid.classList.add('reorder-mode');
    dnd.enable();
    swapArrows.enable();
  }
}

async function saveReorder(ctx) {
  const buttons = [...grid.querySelectorAll('.category-btn')];
  const ids = buttons.map((b) => b.dataset.catId);
  if (ids.length === 0) return;
  const body = { section: ctx.section, items: ids };
  if (ctx.parentId) body.parentId = ctx.parentId;
  await API.post('/api/categories/reorder', body);
}
