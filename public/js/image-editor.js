import { API } from './api.js';
import { thumbUrl, disableWheelOnNumberInputs, withPending } from './utils.js';
import { showToast } from './toast.js';

const MAX_IMAGES_PER_ITEM = 10;
let settingsCache = null;
let settingsPromise = null;

function getEditorSettings() {
  if (settingsCache !== null) return settingsCache;
  if (settingsPromise) return settingsPromise;
  settingsPromise = (async () => {
    try {
      settingsCache = await API.get('/api/settings');
    } catch {
      settingsCache = {};
    }
    return settingsCache;
  })();
  return settingsPromise;
}

// The shared default image (stock /images/default.svg OR a custom
// settings.defaultImage upload) is a placeholder, not a photo of the item.
// It must never become an editable slot: a "keep" slot for it produces
// finalOrder indexes for images the server does not have in images[],
// which fails the whole save with 400 (B2).
function isDefaultImage(src, settings) {
  if (!src) return true;
  if (src.includes('/images/default.svg')) return true;
  return Boolean(settings && settings.defaultImage && src === settings.defaultImage);
}

// Effective photo list of an item: images[] when present, otherwise the
// legacy single `image` field (real uploads only, never the default).
// Used by BOTH openEdit (slot building) and saveEdit (removal accounting) —
// the two must always agree, or indexes get out of sync.
function realItemImages(item, settings) {
  if (item.images && item.images.length > 0) return item.images;
  if (item.image && !isDefaultImage(item.image, settings)) return [item.image];
  return [];
}

let editSlots = [];
let editingId = null;
let editCurrentItem = null;
let onSaveCallback = null;
let editTriggerElement = null;
let editSnapshot = null;

// Serialized state of the edit form + image slots, taken when the modal opens.
// Crops flip a slot's type to replace/new and swap its src, so they are
// captured by the slot signature too.
function formSnapshot() {
  const fields = ['editSection', 'editCategory', 'editTitle', 'editAuthor', 'editPrice', 'editRecaster', 'editCombatPoints', 'editStatus']
    .map(id => document.getElementById(id).value);
  const slots = editSlots.map(s => s.type + ':' + s.src);
  return JSON.stringify({ fields, slots });
}

function hasUnsavedEditChanges() {
  return editSnapshot !== null && formSnapshot() !== editSnapshot;
}

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

// B3 fix: when re-cropping an already-cropped slot, cropSrc IS the slot's live
// blob URL. Revoking it on cancel would kill the slot's preview (next render
// falls back to default.svg and invites the user to delete the "broken" slot).
// Only revoke URLs that no slot owns.
function isSlotOwnedURL(url) {
  return editSlots.some(s => s && s.src === url);
}

function revokeCropSrc() {
  if (isObjectURL(cropSrc) && !isSlotOwnedURL(cropSrc)) URL.revokeObjectURL(cropSrc);
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

// Category options for a section: a group can hold items directly (its own id),
// its children are listed underneath — mirrors admin/items.js dropdowns (U2).
function populateEditCategorySelect(cats, sectionId) {
  const sel = document.getElementById('editCategory');
  sel.innerHTML = '';
  const sec = cats[sectionId];
  if (!sec) return;
  for (const c of sec.subcategories) {
    if (c.type === 'group' && c.subcategories) {
      const groupOpt = document.createElement('option');
      groupOpt.value = c.id;
      groupOpt.textContent = c.label;
      sel.appendChild(groupOpt);
      for (const sc of c.subcategories) {
        const opt = document.createElement('option');
        opt.value = sc.id;
        opt.textContent = '  ↳ ' + sc.label;
        sel.appendChild(opt);
      }
    } else {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      sel.appendChild(opt);
    }
  }
}

export async function openEdit(item, { onSave } = {}) {
  if (document.getElementById('editModal').classList.contains('open')) {
    // U4: switching to another item counts as closing — same discard guard
    if (!closeEdit()) return;
  }
  editingId = item.id;
  editCurrentItem = item;
  onSaveCallback = onSave || null;

  const settings = await getEditorSettings();
  const imgs = realItemImages(item, settings);
  editSlots = imgs.map((src, i) => ({ type: 'keep', originalIdx: i, src }));

  document.getElementById('editId').value = item.id;
  document.getElementById('editTitle').value = item.title;
  document.getElementById('editAuthor').value = item.author || '';
  document.getElementById('editPrice').value = item.price != null ? item.price : '';
  document.getElementById('editRecaster').value = item.recaster || '';
  document.getElementById('editCombatPoints').value = item.combatPoints || '';
  document.getElementById('editStatus').value = item.status || '';

  // U2: section/category selects let the item move between categories/sections.
  // The server re-anchors sort_order at the end of the target category.
  let cats = {};
  try {
    cats = await API.get('/api/categories');
  } catch {
    // Categories failed to load: the fallbacks below pin both selects to the
    // item's current values, so other fields stay editable and the item is
    // never silently moved (same as before U2, when moving was impossible)
  }
  const sectionSel = document.getElementById('editSection');
  sectionSel.innerHTML = '';
  for (const [id, sec] of Object.entries(cats)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = sec.label;
    sectionSel.appendChild(opt);
  }
  sectionSel.value = item.section;
  if (sectionSel.value !== item.section) {
    // Legacy data: the item's section is not in the tree — keep it visible
    const opt = document.createElement('option');
    opt.value = item.section;
    opt.textContent = item.section;
    sectionSel.appendChild(opt);
    sectionSel.value = item.section;
  }
  populateEditCategorySelect(cats, item.section);
  const catSel = document.getElementById('editCategory');
  catSel.value = item.category;
  if (catSel.value !== item.category) {
    // Legacy data: the item's category is not in the tree — keep it visible
    // instead of silently preselecting a different category
    const opt = document.createElement('option');
    opt.value = item.category;
    opt.textContent = item.category;
    catSel.appendChild(opt);
    catSel.value = item.category;
  }

  const sections = (await getEditorSettings()).sectionsWithExtraFields || ['miniatures'];
  document.querySelectorAll('#editModal .mini-field').forEach(el => {
    if (sections.includes(item.section)) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  document.getElementById('editImage').value = '';
  renderEditImages();
  editSnapshot = formSnapshot(); // U4: baseline for the unsaved-changes guard
  lockScroll();
  editTriggerElement = document.activeElement; // capture before trapFocus moves focus into the modal
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
    img.src = thumbUrl(slot.src) || '/images/default.svg';
    img.alt = 'Image ' + (i + 1) + ' of item';
    img.onerror = function () {
      // B3: one-shot fallback thumb -> full image -> default.svg (src comparison is unreliable: absolute vs relative)
      if (!this.dataset.fullTried && slot.src) {
        this.dataset.fullTried = '1';
        this.src = slot.src;
      } else {
        this.src = '/images/default.svg';
        this.onerror = null;
      }
    };
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
  if (document.getElementById('cropModal').classList.contains('open')) {
    closeCrop();
  }
  revokeCropSrc();
  cropSrc = imageSrc;
  cropQueue = (ctx && ctx.fileQueue) || [];
  const cropImg = document.getElementById('cropImage');
  cropImg.onload = () => {
    if (cropper) cropper.destroy();
    try {
      cropper = new Cropper(cropImg, {
        aspectRatio: NaN,
        viewMode: 1,
        autoCropArea: 0.9,
        background: false,
      });
    } catch (e) {
      closeCrop();
      return;
    }
    trapFocus(document.getElementById('cropModal'));
    cropImg.onload = null;
  };
  cropImg.onerror = () => {
    cropImg.onerror = null;
    showToast('Could not load image for cropping', 'error');
    closeCrop();
  };
  // removeAttribute (not src='') forces a re-load for identical URLs without queuing a spurious error event
  cropImg.removeAttribute('src');
  cropImg.src = imageSrc;
  lockScroll();
  document.getElementById('cropModal').classList.add('open');
  document.addEventListener('keydown', onEscapeKey);
  cropCtx = ctx;
}

function closeCrop() {
  if (cropper) { cropper.destroy(); cropper = null; }
  revokeCropSrc();
  cropQueue.forEach(url => { if (isObjectURL(url)) URL.revokeObjectURL(url); });
  cropQueue = [];
  releaseTrap(document.getElementById('cropModal'));
  cropSrc = null;
  cropCtx = null;
  document.getElementById('cropModal').classList.remove('open');
  if (!document.getElementById('editModal')?.classList.contains('open')) {
    document.removeEventListener('keydown', onEscapeKey);
  }
}

function loadNextFile() {
  if (cropQueue.length === 0) return;
  const nextFile = cropQueue.shift();
  const queue = cropQueue.slice();
  const reader = new FileReader();
  reader.onload = (e) => {
    closeCrop();
    openCrop(e.target.result, { fileQueue: queue, slotIdx: undefined });
  };
  reader.readAsDataURL(nextFile);
}

function applyCrop() {
  if (!cropper || !cropCtx) return;
  const canvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });
  const ctx = cropCtx;
  const slotIdx = ctx.slotIdx;

  canvas.toBlob(blob => {
    if (!blob) {
      showToast('Crop failed: could not encode image', 'error');
      closeCrop();
      return;
    }
    const file = new File([blob], 'cropped-' + Date.now() + '.jpg', { type: 'image/jpeg' });
    // B2: closeCrop() wipes cropQueue — capture remaining files first, restore after close
    const remaining = cropQueue.slice();

    if (typeof slotIdx === 'number' && editSlots[slotIdx]) {
      const slot = editSlots[slotIdx];
      revokeSlot(slot);
      // Keep 'new' slots as 'new': they have no original index on the server,
      // so marking them 'replace' would send imagesToRemove:[null] and fail with 400.
      if (slot.type === 'new') {
        editSlots[slotIdx] = { type: 'new', originalIdx: null, file, src: URL.createObjectURL(blob) };
      } else {
        editSlots[slotIdx] = { type: 'replace', originalIdx: slot.originalIdx, file, src: URL.createObjectURL(blob) };
      }
      renderEditImages();
      closeCrop();
      cropQueue = remaining;
      loadNextFile();
      return;
    }

    editSlots.push({ type: 'new', originalIdx: null, file, src: URL.createObjectURL(blob) });
    renderEditImages();
    closeCrop();
    cropQueue = remaining;
    loadNextFile();
  }, 'image/jpeg', 0.92);
}

async function saveEdit() {
  const section = document.getElementById('editSection').value;
  const category = document.getElementById('editCategory').value;
  if (!section || !category) {
    showToast('Select a section and category', 'error');
    return;
  }

  const fd = new FormData();
  fd.append('section', section);
  fd.append('category', category);
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

  // Must mirror the slot source used by openEdit exactly (same helper),
  // otherwise the default image would be counted as a removable original
  // and produce out-of-bounds imagesToRemove indexes (B2).
  const originalImgs = realItemImages(editCurrentItem, await getEditorSettings());
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
      showToast('Item was modified in another session. Please reload and try again.', 'error');
      closeEdit(true);
      return;
    }
    showToast('Save failed: ' + (err.message || 'Unknown error'), 'error');
    return;
  }
  if (onSaveCallback) onSaveCallback();
  closeEdit(true);
}

function onEscapeKey(e) {
  if (e.key === 'Escape') {
    const editModal = document.getElementById('editModal');
    const cropModal = document.getElementById('cropModal');
    if (cropModal.classList.contains('open')) closeCrop();
    else if (editModal.classList.contains('open')) closeEdit();
  }
}

// Returns false when the user chose to keep editing (unsaved changes guard).
// `force` skips the guard: used after a successful save / fatal conflict.
function closeEdit(force = false) {
  if (!force && hasUnsavedEditChanges()) {
    if (!confirm('Discard unsaved changes?')) return false;
  }
  unlockScroll();
  releaseTrap(document.getElementById('editModal'));
  document.getElementById('editModal').classList.remove('open');
  if (!document.getElementById('cropModal')?.classList.contains('open')) {
    document.removeEventListener('keydown', onEscapeKey);
  }
  editSlots.forEach(revokeSlot);
  editSlots = [];
  editCurrentItem = null;
  editingId = null;
  onSaveCallback = null;
  editSnapshot = null;
  if (editTriggerElement) { editTriggerElement.focus(); editTriggerElement = null; }
  return true;
}

export function initImageEditor() {
  disableWheelOnNumberInputs();
  document.getElementById('editSection').addEventListener('change', async function() {
    const cats = await API.get('/api/categories');
    populateEditCategorySelect(cats, this.value);
    // Extra fields (Recaster/Combat Points/Status) follow the target section,
    // same visibility rule as when the modal opens
    const settings = await getEditorSettings();
    const sections = settings.sectionsWithExtraFields || ['miniatures'];
    document.querySelectorAll('#editModal .mini-field').forEach(el => {
      if (sections.includes(this.value)) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  });
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
      showToast('Maximum ' + MAX_IMAGES_PER_ITEM + ' images total. You can add ' + available + ' more.', 'error');
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

  const saveEditBtn = document.getElementById('saveEditBtn');
  saveEditBtn.addEventListener('click', async () => {
    // B4 fix: guard against double-click — a second PUT with the same version
    // would hit the optimistic lock and show a false conflict toast.
    try {
      await withPending(saveEditBtn, saveEdit);
    } catch (err) {
      showToast('Save failed: ' + (err.message || 'Unknown error'), 'error');
    }
  });

  // NB: () => closeEdit() — a direct reference would pass the click Event
  // as the `force` argument and silently skip the unsaved-changes guard
  document.getElementById('cancelEditBtn').addEventListener('click', () => closeEdit());

  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModal')) closeEdit();
  });
}
