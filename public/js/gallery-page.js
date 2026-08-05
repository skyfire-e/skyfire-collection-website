import { API, checkAuth, isAdmin } from './api.js';
import { showToast } from './toast.js';
import { thumbUrl, createFocusTrap, withPending } from './utils.js';
import { openEdit, initImageEditor } from './image-editor.js';
import { injectSharedModals } from './shared-modals.js';
import { createReorderDnd, createSwapArrows } from './dnd.js';

// Edit/crop/lightbox dialogs come from the shared module (single source of truth)
injectSharedModals();

// A subgroup page (e.g. /miniatures/skaven) renders items filed at the group's own
// root: section/category come from the path, and a dedicated grid is used so the
// category buttons rendered by section-pages.js stay untouched.
function isSubgroupPage() {
  return document.body.dataset.pageType === 'subgroup';
}

function getGalleryContext() {
  if (isSubgroupPage()) {
    const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    return { section: parts[0] || null, category: parts[1] || null };
  }
  const params = new URLSearchParams(location.search);
  return { section: params.get('section'), category: params.get('category') };
}

function getGalleryGrid() {
  return document.getElementById(isSubgroupPage() ? 'subgroupItemsGrid' : 'galleryGrid');
}

// Bound to the page's gallery grid in initGalleryPage (dnd.js, shared with
// section-pages.js). The container element persists across re-renders, so one
// instance is enough — enable() re-binds to the current cards.
let dnd = null;
let swapArrows = null;

export async function initGalleryPage() {
  const { section, category } = getGalleryContext();
  const subgroup = isSubgroupPage();
  const grid = getGalleryGrid();
  if (!grid) return;
  dnd = createReorderDnd(grid, '.gallery-card');
  swapArrows = createSwapArrows(grid, '.gallery-card');
  const title = document.getElementById('pageTitle');
  const backLink = document.getElementById('galleryBackLink');

  // Set dynamic back link
  if (backLink && section) {
    try {
      const cats = await API.get('/api/categories');
      const sec = cats[section];
      if (sec) {
        const cat = sec.subcategories.find((c) => c.id === category);
        const parentGroup = sec.subcategories.find(
          (c) => c.type === 'group' && c.subcategories?.find((sc) => sc.id === category)
        );
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

  // On a subgroup page the heading/title are owned by section-pages.js
  if (category && backLink && !subgroup) {
    (async () => {
      try {
        const data = await API.get('/api/categories');
        for (const sec of Object.values(data)) {
          for (const cat of sec.subcategories) {
            if (cat.id === category) {
              setPageTitle(cat.label);
              return;
            }
            if (cat.subcategories) {
              const found = cat.subcategories.find((s) => s.id === category);
              if (found) {
                setPageTitle(found.label);
                return;
              }
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
    for (const p of lbPreloaders) {
      p.src = '';
      p.onload = p.onerror = null;
    }
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
    if (lbFocusTrap) {
      lightbox.removeEventListener('keydown', lbFocusTrap);
      lbFocusTrap = null;
    }
    for (const p of lbPreloaders) {
      p.src = '';
      p.onload = p.onerror = null;
    }
    lbPreloaders = [];
    if (lbTriggerElement) {
      lbTriggerElement.focus();
      lbTriggerElement = null;
    }
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

    const lbHint = document.getElementById('lbHint');
    if (lbHint) lbHint.classList.toggle('show', lbCurrentImages.length > 1);

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
          lbDots.querySelectorAll('.lightbox-dot').forEach((d) => d.classList.remove('active'));
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
    items.forEach((item) => {
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
      img.addEventListener('error', function () {
        // B3: one-shot fallback thumb -> full image -> default.svg
        // (this.src is absolute, item.image is relative — direct comparison always mismatches)
        if (!this.dataset.fullTried && item.image) {
          this.dataset.fullTried = '1';
          this.src = item.image;
        } else {
          handleImgError(this);
        }
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
            // B4 fix: withPending guards against double-click — the second
            // DELETE would return 404 and show a false error toast.
            await withPending(delBtn, () => API.del('/api/items/' + item.id, { version: item.version }));
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
        // In reorder mode taps rearrange cards — they must not open the
        // lightbox (category links in section-pages.js have the same guard)
        if (reorderMode) return;
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
      // On a subgroup page the whole items block stays hidden when the group root is empty
      if (subgroup) {
        document.getElementById('subgroupItemsSection')?.classList.toggle('hidden', items.length === 0);
      }
      if (reorderMode && dnd) dnd.enable();
      if (reorderMode && swapArrows) swapArrows.enable();
    } catch (err) {
      // Surface the real reason (e.g. rate limit) instead of a generic failure —
      // an empty grid used to look like the collection had vanished.
      grid.textContent = '';
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'Failed to load items: ' + (err.message || 'Unknown error');
      grid.appendChild(p);
    }
  }

  // Lightbox controls
  const $ = (id) => document.getElementById(id);
  const el = (id) => {
    const e = $(id);
    if (!e) console.warn('#' + id + ' not found in DOM');
    return e;
  };

  el('lbClose')?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  function prevImage() {
    if (lbCurrentImages.length === 0) return;
    lbCurrentImgIdx = lbCurrentImgIdx > 0 ? lbCurrentImgIdx - 1 : lbCurrentImages.length - 1;
    loadLightboxImage(lbCurrentImages[lbCurrentImgIdx], updateDots);
  }

  function nextImage() {
    if (lbCurrentImages.length === 0) return;
    lbCurrentImgIdx = lbCurrentImgIdx < lbCurrentImages.length - 1 ? lbCurrentImgIdx + 1 : 0;
    loadLightboxImage(lbCurrentImages[lbCurrentImgIdx], updateDots);
  }

  el('lbPrev')?.addEventListener('click', prevImage);
  el('lbNext')?.addEventListener('click', nextImage);

  // Invisible left/right screen-edge tap zones (mobile only, shown via CSS)
  el('lbEdgeLeft')?.addEventListener('click', (e) => { e.stopPropagation(); prevImage(); });
  el('lbEdgeRight')?.addEventListener('click', (e) => { e.stopPropagation(); nextImage(); });

  // Touch swipe for lightbox
  let touchStartX = 0;
  lbImg?.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true }
  );
  lbImg?.addEventListener(
    'touchend',
    (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) nextImage();
        else prevImage();
      }
    },
    { passive: true }
  );

  function onLightboxKeydown(e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'ArrowRight') nextImage();
  }
  document.addEventListener('keydown', onLightboxKeydown);

  initImageEditor();

  await checkAuth();
  if (isAdmin()) {
    el('adminActions')?.classList.remove('hidden');
    const reorderContainer = document.getElementById('reorderActions');
    // B3: item order is stored per (section, category) — without both there is
    // nothing the server could save, so don't offer the button at all
    // (e.g. /gallery opened without query params).
    if (reorderContainer && section && category) {
      reorderContainer.classList.remove('hidden');
      const reorderBtn = document.createElement('button');
      reorderBtn.className = 'nav-corner-btn reorder-corner-btn';
      // NB: not "reorderBtn" — section-pages.js uses that id for its category
      // reorder button, and both scripts run together on subgroup pages
      reorderBtn.id = 'itemReorderBtn';
      reorderBtn.title = 'Re-arrange items';
      reorderBtn.setAttribute('aria-label', 'Re-arrange items');
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
  const btn = document.getElementById('itemReorderBtn');
  const grid = getGalleryGrid();
  if (reorderMode) {
    try {
      await saveReorder();
    } catch (err) {
      showToast('Failed to save order: ' + (err.message || 'Unknown error'), 'error');
      return;
    }
    // Icon-only labels: the button is a 48px circle, text does not fit
    btn.textContent = '🔀';
    btn.title = 'Re-arrange';
    btn.classList.remove('btn-success');
    grid.classList.remove('reorder-mode');
    dnd.disable();
    swapArrows.disable();
    reorderMode = false;
    showToast('Order saved', 'success');
  } else {
    reorderMode = true;
    btn.textContent = '✓';
    btn.title = 'Done — save order';
    btn.classList.add('btn-success');
    grid.classList.add('reorder-mode');
    dnd.enable();
    swapArrows.enable();
  }
}

async function saveReorder() {
  // B1: section/category are scoped to initGalleryPage — resolve them from the page context here
  const { section, category } = getGalleryContext();
  if (!section || !category) {
    console.warn('Reorder requires section and category');
    return;
  }
  const grid = getGalleryGrid();
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.gallery-card')];
  const itemIds = cards.map((c) => c.dataset.itemId);
  if (itemIds.length === 0) return;
  // B1: no inner try/catch — toggleReorder handles failures and keeps reorder mode on
  await API.post('/api/items/reorder', { section, category, items: itemIds });
}

initGalleryPage().catch((err) => console.error('Gallery init failed:', err));
