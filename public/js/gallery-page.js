import { API, checkAuth, isAdmin } from './api.js';
import { showToast } from './toast.js';
import { thumbUrl, createFocusTrap } from './utils.js';
import { openEdit, initImageEditor } from './image-editor.js';

export async function initGalleryPage() {
  const params = new URLSearchParams(location.search);
  const section = params.get('section');
  const category = params.get('category');
  const grid = document.getElementById('galleryGrid');
  const title = document.getElementById('pageTitle');
  const backLink = document.getElementById('galleryBackLink');

  // Set dynamic back link
  if (backLink && section) {
    try {
      const cats = await API.get('/api/categories');
      const sec = cats[section];
      if (sec) {
        const cat = sec.subcategories.find(c => c.id === category);
        const parentGroup = sec.subcategories.find(c => c.type === 'group' && c.subcategories?.find(sc => sc.id === category));
        // Items filed directly under a group's own root (category === the group's id itself)
        // should link back into that group's subgroup page, not the top-level section page.
        const isGroupRoot = !parentGroup && cat && cat.type === 'group';
        let label, backHref;
        if (parentGroup) {
          label = parentGroup.label;
          backHref = '/' + encodeURIComponent(section) + '/' + encodeURIComponent(parentGroup.id);
        } else if (isGroupRoot) {
          label = cat.label;
          backHref = '/' + encodeURIComponent(section) + '/' + encodeURIComponent(cat.id);
        } else {
          label = sec.label;
          backHref = '/' + encodeURIComponent(section);
        }
        backLink.href = backHref;
        backLink.textContent = '';
        const arrow = document.createElement('span');
        arrow.className = 'back-arrow';
        arrow.textContent = '\u2190';
        const text = document.createElement('span');
        text.className = 'back-text';
        text.textContent = 'Back to ' + label;
        backLink.appendChild(arrow);
        backLink.appendChild(text);
      }
    } catch (err) {
      console.error('Failed to set back link:', err);
    }
  }

  // Lightbox state
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbTitle = document.getElementById('lbTitle');
  const lbAuthor = document.getElementById('lbAuthor');
  const lbDots = document.getElementById('lbDots');
  let lbCurrentImages = [];
  let lbCurrentImgIdx = 0;
  let lbPreloaders = [];

  function setPageTitle(label) {
    title.textContent = label;
    document.title = label + ' - skyfire Collection';
  }

  if (category && backLink) {
    (async () => {
      try {
        const data = await API.get('/api/categories');
        for (const sec of Object.values(data)) {
          for (const cat of sec.subcategories) {
            if (cat.id === category) { setPageTitle(cat.label); return; }
            if (cat.subcategories) {
              const found = cat.subcategories.find(s => s.id === category);
              if (found) { setPageTitle(found.label); return; }
            }
          }
        }
      } catch {}
    })();
  }

  let lbFocusTrap = null;
  let lbTriggerElement = null;

  function loadLightboxImage(url, then) {
    lbImg.src = '';
    const preloader = new Image();
    preloader.onload = preloader.onerror = () => {
      lbImg.src = url;
      if (then) then();
    };
    if (url) preloader.src = url;
    else if (then) then();
  }

  function openLightbox(item) {
    lbCurrentImages = item.images && item.images.length > 0 ? item.images : [item.image];
    lbCurrentImgIdx = 0;
    lbImg.alt = item.title || 'Image preview';
    for (const p of lbPreloaders) { p.src = ''; p.onload = p.onerror = null; }
    lbPreloaders = [];
    for (let i = 1; i < lbCurrentImages.length; i++) {
      const p = new Image();
      p.src = lbCurrentImages[i];
      lbPreloaders.push(p);
    }
    updateLightbox(item);
    loadLightboxImage(lbCurrentImages[0]);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    const focusable = lightbox.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) focusable[0].focus();
    lbFocusTrap = createFocusTrap(lightbox);
    if (lbFocusTrap) lightbox.addEventListener('keydown', lbFocusTrap);
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    if (lbFocusTrap) { lightbox.removeEventListener('keydown', lbFocusTrap); lbFocusTrap = null; }
    for (const p of lbPreloaders) { p.src = ''; p.onload = p.onerror = null; }
    lbPreloaders = [];
    if (lbTriggerElement) { lbTriggerElement.focus(); lbTriggerElement = null; }
  }

  function updateLightbox(item) {
    lbImg.alt = item.title || '';
    lbTitle.textContent = item.title;
    lbAuthor.textContent = item.author || '';

    const lbPrev = document.getElementById('lbPrev');
    const lbNext = document.getElementById('lbNext');
    if (lbCurrentImages.length <= 1) {
      lbPrev.classList.add('hidden-nav');
      lbNext.classList.add('hidden-nav');
    } else {
      lbPrev.classList.remove('hidden-nav');
      lbNext.classList.remove('hidden-nav');
    }

    lbDots.innerHTML = '';
    if (lbCurrentImages.length > 1) {
      lbCurrentImages.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'lightbox-dot' + (i === lbCurrentImgIdx ? ' active' : '');
        dot.role = 'button';
        dot.tabIndex = 0;
        dot.setAttribute('aria-label', 'Image ' + (i + 1) + ' of ' + lbCurrentImages.length);
        dot.addEventListener('click', () => {
          lbCurrentImgIdx = i;
          loadLightboxImage(lbCurrentImages[i]);
          lbDots.querySelectorAll('.lightbox-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
        });
        dot.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dot.click();
          }
        });
        lbDots.appendChild(dot);
      });
    }
  }

  function updateDots() {
    lbDots.querySelectorAll('.lightbox-dot').forEach((d, i) => {
      d.classList.toggle('active', i === lbCurrentImgIdx);
    });
  }

  function handleImgError(img) {
    if (!img.dataset.fallbackAttempted) {
      img.dataset.fallbackAttempted = '1';
      img.src = '/images/default.svg';
    }
  }

  function renderItems(items) {
    grid.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.textContent = '\ud83d\udced';
      empty.appendChild(icon);
      const p = document.createElement('p');
      p.textContent = 'No items yet';
      empty.appendChild(p);
      grid.appendChild(empty);
      return;
    }
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.id = 'item-' + item.id;
      card.dataset.itemId = item.id;

      const imgCount = item.images && item.images.length > 0 ? item.images.length : 1;

      const imgWrap = document.createElement('div');
      imgWrap.className = 'img-wrap' + (imgCount > 1 ? ' multi-img' : '');

      const img = document.createElement('img');
      img.src = thumbUrl(item.image);
      img.alt = item.title || '';
      img.loading = 'lazy';
      img.addEventListener('error', function() {
        // B3: one-shot fallback thumb -> full image -> default.svg
        // (this.src is absolute, item.image is relative — direct comparison always mismatches)
        if (!this.dataset.fullTried && item.image) {
          this.dataset.fullTried = '1';
          this.src = item.image;
        } else { handleImgError(this); }
      });
      imgWrap.appendChild(img);

      if (imgCount > 1) {
        const badge = document.createElement('span');
        badge.className = 'img-count-badge';
        badge.textContent = imgCount + ' photos';
        imgWrap.appendChild(badge);
      }

      card.appendChild(imgWrap);

      const cardBody = document.createElement('div');
      cardBody.className = 'card-body';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'title';
      titleDiv.textContent = item.title;
      cardBody.appendChild(titleDiv);

      const authorDiv = document.createElement('div');
      authorDiv.className = 'author';
      authorDiv.textContent = item.author || '';
      cardBody.appendChild(authorDiv);

      card.appendChild(cardBody);

      if (isAdmin()) {
        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.dataset.id = item.id;
        editBtn.textContent = '\u270f\ufe0f Edit';
        actions.appendChild(editBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'del-btn';
        delBtn.dataset.id = item.id;
        delBtn.textContent = '\ud83d\uddd1\ufe0f Delete';
        actions.appendChild(delBtn);

        card.appendChild(actions);

        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Delete "' + item.title + '"?')) return;
          try {
            await API.del('/api/items/' + item.id, { version: item.version });
            loadItems();
          } catch (err) {
            showToast('Delete failed: ' + (err.message || 'Unknown error'), 'error');
          }
        });
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEdit(item, { onSave: loadItems });
        });
      }

      grid.appendChild(card);

      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-actions')) return;
        lbTriggerElement = card;
        openLightbox(item);
      });
    });
  }

  function showLoading() {
    grid.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  }

  async function loadItems() {
    showLoading();
    let url = '/api/items';
    if (section) url += '?section=' + encodeURIComponent(section);
    if (category) url += (section ? '&' : '?') + 'category=' + encodeURIComponent(category);
    try {
      const data = await API.get(url);
      const items = data.items;
      renderItems(items);
      if (reorderMode) enableDragAndDrop(document.getElementById('galleryGrid'));
    } catch (err) {
      grid.innerHTML = '<p class="empty-state">Failed to load items. Please try again.</p>';
    }
  }

  // Lightbox controls
  const $ = (id) => document.getElementById(id);
  const el = (id) => { const e = $(id); if (!e) console.warn('#' + id + ' not found in DOM'); return e; };

  el('lbClose')?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  el('lbPrev')?.addEventListener('click', () => {
    if (lbCurrentImages.length === 0) return;
    lbCurrentImgIdx = lbCurrentImgIdx > 0 ? lbCurrentImgIdx - 1 : lbCurrentImages.length - 1;
    loadLightboxImage(lbCurrentImages[lbCurrentImgIdx], updateDots);
  });

  el('lbNext')?.addEventListener('click', () => {
    if (lbCurrentImages.length === 0) return;
    lbCurrentImgIdx = lbCurrentImgIdx < lbCurrentImages.length - 1 ? lbCurrentImgIdx + 1 : 0;
    loadLightboxImage(lbCurrentImages[lbCurrentImgIdx], updateDots);
  });

  // Touch swipe for lightbox
  let touchStartX = 0;
  lbImg?.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lbImg?.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) el('lbNext')?.click();
      else el('lbPrev')?.click();
    }
  }, { passive: true });

  function onLightboxKeydown(e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') document.getElementById('lbPrev')?.click();
    if (e.key === 'ArrowRight') document.getElementById('lbNext')?.click();
  }
  document.addEventListener('keydown', onLightboxKeydown);

  initImageEditor();

  await checkAuth();
  if (isAdmin()) {
    el('adminActions')?.classList.remove('hidden');
    const reorderContainer = document.getElementById('reorderActions');
    if (reorderContainer) {
      reorderContainer.classList.remove('hidden');
      const reorderBtn = document.createElement('button');
      reorderBtn.className = 'nav-corner-btn reorder-corner-btn';
      reorderBtn.id = 'reorderBtn';
      reorderBtn.title = 'Re-arrange';
      reorderBtn.textContent = '🔀';
      reorderContainer.appendChild(reorderBtn);
      reorderBtn.addEventListener('click', toggleReorder);
    }
  }

  await loadItems();

  if (location.hash.startsWith('#item-')) {
    const itemId = location.hash.slice(1);
    setTimeout(() => {
      const card = document.getElementById(itemId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlighted');
        setTimeout(() => card.classList.remove('highlighted'), 5000);
      } else {
        console.warn('Item card not found for hash:', itemId);
      }
    }, 500);
  }
}

let reorderMode = false;

async function toggleReorder() {
  const btn = document.getElementById('reorderBtn');
  const grid = document.getElementById('galleryGrid');
  if (reorderMode) {
    try {
      await saveReorder();
    } catch (err) {
      showToast('Failed to save order: ' + (err.message || 'Unknown error'), 'error');
      return;
    }
    btn.textContent = '🔀 Re-arrange';
    btn.classList.remove('btn-success');
    grid.classList.remove('reorder-mode');
    disableDragAndDrop(grid);
    reorderMode = false;
  } else {
    reorderMode = true;
    btn.textContent = '✓ Done';
    btn.classList.add('btn-success');
    grid.classList.add('reorder-mode');
    enableDragAndDrop(grid);
  }
}

let dragSrc = null;
let touchReorder = null;

function enableDragAndDrop(grid) {
  grid.querySelectorAll('.gallery-card').forEach(card => {
    card.draggable = true;
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragover', onDragOver);
    card.addEventListener('drop', onDrop);
    card.addEventListener('dragend', onDragEnd);
    card.addEventListener('touchstart', onTouchStart, { passive: true });
    card.addEventListener('touchmove', onTouchMove, { passive: false });
    card.addEventListener('touchend', onTouchEnd, { passive: true });
  });
}

function disableDragAndDrop(grid) {
  grid.querySelectorAll('.gallery-card').forEach(card => {
    card.draggable = false;
    card.removeEventListener('dragstart', onDragStart);
    card.removeEventListener('dragover', onDragOver);
    card.removeEventListener('drop', onDrop);
    card.removeEventListener('dragend', onDragEnd);
    card.removeEventListener('touchstart', onTouchStart);
    card.removeEventListener('touchmove', onTouchMove);
    card.removeEventListener('touchend', onTouchEnd);
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
  if (this !== dragSrc) {
    const grid = this.parentNode;
    const children = [...grid.children];
    const srcIdx = children.indexOf(dragSrc);
    const tgtIdx = children.indexOf(this);
    if (srcIdx < tgtIdx) this.parentNode.insertBefore(dragSrc, this.nextSibling);
    else this.parentNode.insertBefore(dragSrc, this);
  }
}

function onDrop(e) {
  e.preventDefault();
  e.stopPropagation();
}

function onDragEnd() {
  this.style.opacity = '';
  dragSrc = null;
  document.querySelectorAll('.gallery-card').forEach(c => c.style.opacity = '');
}

function onTouchStart(e) {
  const touch = e.touches[0];
  touchReorder = { card: this, startY: touch.clientY, startX: touch.clientX, moved: false };
}

function onTouchMove(e) {
  if (!touchReorder || touchReorder.card !== this) return;
  const touch = e.touches[0];
  const dy = touch.clientY - touchReorder.startY;
  if (Math.abs(dy) > 15) {
    touchReorder.moved = true;
    e.preventDefault();
    const grid = this.parentNode;
    const children = [...grid.querySelectorAll('.gallery-card')];
    const thisRect = this.getBoundingClientRect();
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

async function saveReorder() {
  // B1: section/category are scoped to initGalleryPage — read them from the URL here
  const params = new URLSearchParams(location.search);
  const section = params.get('section');
  const category = params.get('category');
  if (!section || !category) {
    console.warn('Reorder requires section and category');
    return;
  }
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.gallery-card')];
  const itemIds = cards.map(c => c.dataset.itemId);
  if (itemIds.length === 0) return;
  // B1: no inner try/catch — toggleReorder handles failures and keeps reorder mode on
  await API.post('/api/items/reorder', { section, category, items: itemIds });
}

initGalleryPage().catch(err => console.error('Gallery init failed:', err));
