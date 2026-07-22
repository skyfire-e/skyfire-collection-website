import { API, checkAuth, isAdmin } from './api.js';
import { openEdit, initImageEditor } from './image-editor.js';

export async function initGalleryPage() {
  const params = new URLSearchParams(location.search);
  const section = params.get('section');
  const category = params.get('category');
  const grid = document.getElementById('galleryGrid');
  const title = document.getElementById('pageTitle');

  // Lightbox state
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbTitle = document.getElementById('lbTitle');
  const lbAuthor = document.getElementById('lbAuthor');
  const lbDots = document.getElementById('lbDots');
  let lbCurrentImages = [];
  let lbCurrentImgIdx = 0;

  function setPageTitle(label) {
    title.textContent = label;
    document.title = label + ' - skyf1re Collection';
  }

  if (category) {
    API.get('/api/categories').then(data => {
      for (const section of Object.values(data)) {
        for (const cat of section.subcategories) {
          if (cat.id === category) {
            setPageTitle(cat.label);
            return;
          }
          if (cat.subcategories) {
            const found = cat.subcategories.find(s => s.id === category);
            if (found) { setPageTitle(found.label); return; }
          }
        }
      }
    });
  }

  function openLightbox(item) {
    lbCurrentImages = item.images && item.images.length > 0 ? item.images : [item.image];
    lbCurrentImgIdx = 0;
    updateLightbox(item);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function updateLightbox(item) {
    lbImg.src = lbCurrentImages[lbCurrentImgIdx];
    lbTitle.textContent = item.title;
    lbAuthor.textContent = item.author;

    lbDots.innerHTML = '';
    if (lbCurrentImages.length > 1) {
      lbCurrentImages.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'lightbox-dot' + (i === lbCurrentImgIdx ? ' active' : '');
        dot.addEventListener('click', () => {
          lbCurrentImgIdx = i;
          lbImg.src = lbCurrentImages[i];
          lbDots.querySelectorAll('.lightbox-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
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

      const imgCount = item.images && item.images.length > 0 ? item.images.length : 1;

      const imgWrap = document.createElement('div');
      imgWrap.className = 'img-wrap' + (imgCount > 1 ? ' multi-img' : '');

      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title || '';
      img.loading = 'lazy';
      img.addEventListener('error', () => handleImgError(img));
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
      authorDiv.textContent = item.author;
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
          if (confirm('Delete "' + item.title + '"?')) {
            await API.del('/api/items/' + item.id);
            loadItems();
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
        openLightbox(item);
      });
    });
  }

  async function loadItems() {
    let url = '/api/items';
    if (section) url += '?section=' + section;
    if (category) url += (section ? '&' : '?') + 'category=' + category;
    const items = await API.get(url);
    renderItems(items);
  }

  // Lightbox controls
  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.getElementById('lbPrev').addEventListener('click', () => {
    if (lbCurrentImages.length === 0) return;
    lbCurrentImgIdx = lbCurrentImgIdx > 0 ? lbCurrentImgIdx - 1 : lbCurrentImages.length - 1;
    lbImg.src = lbCurrentImages[lbCurrentImgIdx];
    updateDots();
  });

  document.getElementById('lbNext').addEventListener('click', () => {
    if (lbCurrentImages.length === 0) return;
    lbCurrentImgIdx = lbCurrentImgIdx < lbCurrentImages.length - 1 ? lbCurrentImgIdx + 1 : 0;
    lbImg.src = lbCurrentImages[lbCurrentImgIdx];
    updateDots();
  });

  // Touch swipe for lightbox
  let touchStartX = 0;
  lbImg.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lbImg.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) document.getElementById('lbNext').click();
      else document.getElementById('lbPrev').click();
    }
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') document.getElementById('lbPrev').click();
    if (e.key === 'ArrowRight') document.getElementById('lbNext').click();
  });

  initImageEditor();

  await checkAuth();
  if (isAdmin()) document.getElementById('adminActions').style.display = 'flex';
  loadItems();
}

initGalleryPage();
