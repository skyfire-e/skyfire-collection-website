import { API, checkAuth, isAdmin } from './api.js';
import { showToast } from './toast.js';

let grid;

document.addEventListener('DOMContentLoaded', () => {
  grid = document.getElementById('categoryGrid');
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
  a.addEventListener('click', (e) => { if (reorderMode) e.preventDefault(); });
  return a;
}

async function initSectionPage() {
  const sectionId = location.pathname.replace(/^\/|\/$/g, '');
  const titleEl = document.getElementById('pageTitle');
  const titleEl2 = document.getElementById('sectionTitle');

  try {
    const data = await API.get('/api/categories');
    const section = data[sectionId];
    if (!section) { grid.innerHTML = '<p class="empty-state">Section not found.</p>'; return; }
    if (titleEl) titleEl.textContent = section.label + ' - skyfire Collection';
    if (titleEl2) titleEl2.textContent = section.label;

    section.subcategories.forEach(c => grid.appendChild(renderCategoryButton(sectionId, c)));

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
    if (!section) { grid.innerHTML = '<p class="empty-state">Section not found.</p>'; return; }
    const group = section.subcategories.find(c => c.id === groupId);
    if (!group || !group.subcategories) { grid.innerHTML = '<p class="empty-state">Group not found.</p>'; return; }

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

    group.subcategories.forEach(c => grid.appendChild(renderCategoryButton(sectionId, c)));

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
    btn.textContent = '\u{1F500}';
    btn.title = 'Re-arrange categories';
    btn.classList.remove('btn-success');
    grid.classList.remove('reorder-mode');
    disableDragAndDrop();
    reorderMode = false;
    showToast('Category order saved', 'success');
  } else {
    reorderMode = true;
    // Icon-only label: the button is a 48px circle, text does not fit
    btn.textContent = '\u2713';
    btn.title = 'Done — save order';
    btn.classList.add('btn-success');
    grid.classList.add('reorder-mode');
    enableDragAndDrop();
  }
}

async function saveReorder(ctx) {
  const buttons = [...grid.querySelectorAll('.category-btn')];
  const ids = buttons.map(b => b.dataset.catId);
  if (ids.length === 0) return;
  const body = { section: ctx.section, items: ids };
  if (ctx.parentId) body.parentId = ctx.parentId;
  await API.post('/api/categories/reorder', body);
}

let dragSrc = null;
let touchReorder = null;

function enableDragAndDrop() {
  grid.querySelectorAll('.category-btn').forEach(el => {
    el.draggable = true;
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragend', onDragEnd);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
  });
}

function disableDragAndDrop() {
  grid.querySelectorAll('.category-btn').forEach(el => {
    el.draggable = false;
    el.removeEventListener('dragstart', onDragStart);
    el.removeEventListener('dragover', onDragOver);
    el.removeEventListener('drop', onDrop);
    el.removeEventListener('dragend', onDragEnd);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
  });
}

function onDragStart(e) {
  dragSrc = this;
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this !== dragSrc && dragSrc) {
    const children = [...grid.children];
    const srcIdx = children.indexOf(dragSrc);
    const tgtIdx = children.indexOf(this);
    if (srcIdx < tgtIdx) grid.insertBefore(dragSrc, this.nextSibling);
    else grid.insertBefore(dragSrc, this);
  }
}

function onDrop(e) {
  e.preventDefault();
  e.stopPropagation();
}

function onDragEnd() {
  this.style.opacity = '';
  dragSrc = null;
  grid.querySelectorAll('.category-btn').forEach(el => el.style.opacity = '');
}

function onTouchStart(e) {
  const touch = e.touches[0];
  touchReorder = { el: this, startY: touch.clientY, startX: touch.clientX, moved: false };
}

function onTouchMove(e) {
  if (!touchReorder || touchReorder.el !== this) return;
  const touch = e.touches[0];
  const dy = touch.clientY - touchReorder.startY;
  if (Math.abs(dy) > 15) {
    touchReorder.moved = true;
    e.preventDefault();
    const children = [...grid.querySelectorAll('.category-btn')];
    let target = null;
    for (const child of children) {
      if (child === this) continue;
      const r = child.getBoundingClientRect();
      if (touch.clientY < r.top + r.height / 2) { target = child; break; }
    }
    if (target) grid.insertBefore(this, target);
    else grid.appendChild(this);
    touchReorder.startY = touch.clientY;
  }
}

function onTouchEnd() {
  touchReorder = null;
}
