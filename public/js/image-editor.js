import { API } from './api.js';

const MAX_IMAGES_PER_ITEM = 10;
let extraFieldsSections = null;
let extraFieldsPromise = null;

async function getExtraFieldsSections() {
  if (extraFieldsSections !== null) return extraFieldsSections;
  if (extraFieldsPromise) return extraFieldsPromise;
  extraFieldsPromise = (async () => {
    try {
      const settings = await API.get('/api/settings');
      extraFieldsSections = settings.sectionsWithExtraFields || ['miniatures'];
    } catch {
      extraFieldsSections = ['miniatures'];
    }
    return extraFieldsSections;
  })();
  return extraFieldsPromise;
}

function thumbUrl(imgPath) {
  if (!imgPath || !imgPath.startsWith('/uploads/') || imgPath.startsWith('blob:')) return imgPath;
  const basename = imgPath.split('/').pop();
  return '/uploads/thumb-' + basename;
}

let editSlots = [];
let editingId = null;
let editCurrentItem = null;
let onSaveCallback = null;

let cropper = null;
let cropCtx = null;
let cropSrc = null;
let cropQueue = [];

function isObjectURL(url) {
  return url && typeof url === 'string' && url.startsWith('blob:');
}

function revokeSlot(slot) {
  if (slot && isObjectURL(slot.src)) URL.revokeObjectURL(slot.src);
}

function lockScroll() {
  document.body.style.overflow = 'hidden';
}

function unlockScroll() {
  document.body.style.overflow = '';
}

function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first.focus();
  function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  modal.addEventListener('keydown', handler);
  modal._focusTrap = handler;
}

function releaseTrap(modal) {
  if (modal._focusTrap) {
    modal.removeEventListener('keydown', modal._focusTrap);
    delete modal._focusTrap;
  }
}

export async function openEdit(item, { onSave } = {}) {
  editingId = item.id;
  editCurrentItem = item;
  onSaveCallback = onSave || null;

  const imgs = item.images && item.images.length > 0 ? item.images : (item.image && !item.image.includes('default.svg') ? [item.image] : []);
  editSlots = imgs.map((src, i) => ({ type: 'keep', originalIdx: i, src }));

  document.getElementById('editId').value = item.id;
  document.getElementById('editTitle').value = item.title;
  document.getElementById('editAuthor').value = item.author || '';
  document.getElementById('editPrice').value = item.price || '';
  document.getElementById('editRecaster').value = item.recaster || '';
  document.getElementById('editCombatPoints').value = item.combatPoints || '';
  document.getElementById('editStatus').value = item.status || '';

  const sections = await getExtraFieldsSections();
  document.querySelectorAll('#editModal .mini-field').forEach(el => {
    if (sections.includes(item.section)) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  document.getElementById('editImage').value = '';
  renderEditImages();
  lockScroll();
  document.getElementById('editModal').classList.add('open');
  trapFocus(document.getElementById('editModal'));
  document.addEventListener('keydown', onEscapeKey);
}

function renderEditImages() {
  const grid = document.getElementById('editImageGrid');
  grid.innerHTML = '';
  const counter = document.getElementById('editImageCounter');
  if (counter) counter.textContent = editSlots.length + ' / ' + MAX_IMAGES_PER_ITEM;
  editSlots.forEach((slot, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'edit-img-item';

    const img = document.createElement('img');
    img.src = thumbUrl(slot.src);
    img.alt = 'Image ' + (i + 1) + ' of item';
    img.onerror = function () { if (this.src !== slot.src) { this.src = slot.src; } else { this.src = '/images/default.svg'; } };
    wrapper.appendChild(img);

    const leftBtn = document.createElement('button');
    leftBtn.className = 'edit-img-move-left';
    leftBtn.textContent = '\u2039';
    if (i === 0) leftBtn.disabled = true;
    leftBtn.addEventListener('click', () => {
      [editSlots[i - 1], editSlots[i]] = [editSlots[i], editSlots[i - 1]];
      renderEditImages();
    });
    wrapper.appendChild(leftBtn);

    const rightBtn = document.createElement('button');
    rightBtn.className = 'edit-img-move-right';
    rightBtn.textContent = '\u203A';
    if (i === editSlots.length - 1) rightBtn.disabled = true;
    rightBtn.addEventListener('click', () => {
      [editSlots[i], editSlots[i + 1]] = [editSlots[i + 1], editSlots[i]];
      renderEditImages();
    });
    wrapper.appendChild(rightBtn);

    const cropBtn = document.createElement('button');
    cropBtn.className = 'edit-img-crop';
    cropBtn.textContent = '\u270E';
    cropBtn.addEventListener('click', () => {
      openCrop(slot.src, { slotIdx: i });
    });
    wrapper.appendChild(cropBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'edit-img-del';
    delBtn.textContent = '\u00D7';
    delBtn.addEventListener('click', () => {
      editSlots.splice(i, 1);
      renderEditImages();
    });
    wrapper.appendChild(delBtn);

    const idxSpan = document.createElement('span');
    idxSpan.className = 'edit-img-idx';
    idxSpan.textContent = '#' + (i + 1);
    wrapper.appendChild(idxSpan);

    grid.appendChild(wrapper);
  });
}

// --- Crop Modal ---
function openCrop(imageSrc, ctx) {
  if (isObjectURL(cropSrc)) URL.revokeObjectURL(cropSrc);
  cropSrc = imageSrc;
  cropQueue = (ctx && ctx.fileQueue) || [];
  const cropImg = document.getElementById('cropImage');
  cropImg.onload = () => {
    if (cropper) cropper.destroy();
    cropper = new Cropper(cropImg, {
      aspectRatio: NaN,
      viewMode: 1,
      autoCropArea: 0.9,
      background: false,
    });
    cropImg.onload = null;
  };
  cropImg.src = imageSrc;
  lockScroll();
  document.getElementById('cropModal').classList.add('open');
  trapFocus(document.getElementById('cropModal'));
  document.addEventListener('keydown', onEscapeKey);
  cropCtx = ctx;
}

function closeCrop() {
  if (cropper) { cropper.destroy(); cropper = null; }
  if (isObjectURL(cropSrc)) URL.revokeObjectURL(cropSrc);
  releaseTrap(document.getElementById('cropModal'));
  cropSrc = null;
  const hadQueue = cropQueue && cropQueue.length > 0;
  cropCtx = null;
  document.getElementById('cropModal').classList.remove('open');
  document.removeEventListener('keydown', onEscapeKey);
  if (hadQueue) loadNextFile();
}

function loadNextFile() {
  if (cropQueue.length === 0) return;
  const nextFile = cropQueue.shift();
  const reader = new FileReader();
  reader.onload = (e) => {
    closeCrop();
    openCrop(e.target.result, { fileQueue: cropQueue, slotIdx: undefined });
  };
  reader.readAsDataURL(nextFile);
}

function applyCrop() {
  if (!cropper || !cropCtx) return;
  const canvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });
  const ctx = cropCtx;
  const slotIdx = ctx.slotIdx;

  canvas.toBlob(blob => {
    const file = new File([blob], 'cropped-' + Date.now() + '.jpg', { type: 'image/jpeg' });

    if (typeof slotIdx === 'number' && editSlots[slotIdx]) {
      const slot = editSlots[slotIdx];
      revokeSlot(slot);
      editSlots[slotIdx] = { type: 'replace', originalIdx: slot.originalIdx, file, src: URL.createObjectURL(blob) };
      renderEditImages();
      closeCrop();
      loadNextFile();
      return;
    }

    editSlots.push({ type: 'new', originalIdx: null, file, src: URL.createObjectURL(blob) });
    renderEditImages();
    closeCrop();
    loadNextFile();
  }, 'image/jpeg', 0.92);
}

async function saveEdit() {
  const fd = new FormData();
  fd.append('title', document.getElementById('editTitle').value);
  fd.append('author', document.getElementById('editAuthor').value);
  fd.append('price', document.getElementById('editPrice').value);
  fd.append('recaster', document.getElementById('editRecaster').value);
  fd.append('combatPoints', document.getElementById('editCombatPoints').value);
  fd.append('status', document.getElementById('editStatus').value);

  const allRemoved = [];
  const finalOrder = [];

  for (const slot of editSlots) {
    if (slot.type === 'keep') {
      finalOrder.push(slot.originalIdx);
    } else if (slot.type === 'replace') {
      fd.append('images', slot.file);
      finalOrder.push(-1);
      if (!allRemoved.includes(slot.originalIdx)) allRemoved.push(slot.originalIdx);
    } else if (slot.type === 'new') {
      fd.append('images', slot.file);
      finalOrder.push(-1);
    }
  }

  const originalImgs = editCurrentItem.images && editCurrentItem.images.length > 0 ? editCurrentItem.images : (editCurrentItem.image && !editCurrentItem.image.includes('default.svg') ? [editCurrentItem.image] : []);
  for (let i = 0; i < originalImgs.length; i++) {
    const stillPresent = editSlots.some(s => (s.type === 'keep' || s.type === 'replace') && s.originalIdx === i);
    if (!stillPresent && !allRemoved.includes(i)) {
      allRemoved.push(i);
    }
  }

  if (allRemoved.length > 0) {
    fd.append('imagesToRemove', JSON.stringify(allRemoved));
  }
  fd.append('finalOrder', JSON.stringify(finalOrder));
  if (editCurrentItem.version !== undefined) {
    fd.append('version', String(editCurrentItem.version));
  }

  try {
    await API.put('/api/items/' + editingId, fd);
  } catch (err) {
    if (err.status === 409) {
      alert('Item was modified in another session. Please reload and try again.');
      closeEdit();
      return;
    }
    alert('Save failed: ' + (err.message || 'Unknown error'));
    return;
  }
  if (onSaveCallback) onSaveCallback();
  closeEdit();
}

function onEscapeKey(e) {
  if (e.key === 'Escape') {
    const editModal = document.getElementById('editModal');
    const cropModal = document.getElementById('cropModal');
    if (cropModal.classList.contains('open')) closeCrop();
    else if (editModal.classList.contains('open')) closeEdit();
  }
}

function closeEdit() {
  unlockScroll();
  releaseTrap(document.getElementById('editModal'));
  document.getElementById('editModal').classList.remove('open');
  document.removeEventListener('keydown', onEscapeKey);
  editSlots.forEach(revokeSlot);
  editSlots = [];
  editCurrentItem = null;
  editingId = null;
  onSaveCallback = null;
}

export function initImageEditor() {
  document.getElementById('cropApplyBtn').addEventListener('click', applyCrop);
  document.getElementById('cropCancelBtn').addEventListener('click', closeCrop);
  document.getElementById('cropModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('cropModal')) closeCrop();
  });

  document.getElementById('editImage').addEventListener('change', function() {
    const files = Array.from(this.files);
    if (files.length === 0) return;
    this.value = '';
    const available = MAX_IMAGES_PER_ITEM - editSlots.length;
    if (files.length > available) {
      alert('Maximum ' + MAX_IMAGES_PER_ITEM + ' images total. You can add ' + available + ' more.');
      return;
    }
    const fileQueue = files.slice(1);
    const currentFile = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      openCrop(e.target.result, { fileQueue, slotIdx: undefined });
    };
    reader.readAsDataURL(currentFile);
  });

  document.getElementById('addImagesBtn').addEventListener('click', () => {
    document.getElementById('editImage').click();
  });

  document.getElementById('saveEditBtn').addEventListener('click', async () => {
    try {
      await saveEdit();
    } catch (err) {
      alert('Save failed: ' + (err.message || 'Unknown error'));
    }
  });

  document.getElementById('cancelEditBtn').addEventListener('click', closeEdit);

  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModal')) closeEdit();
  });
}
