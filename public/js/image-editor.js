import { API } from './api.js';

let editSlots = [];
let editingId = null;
let editCurrentItem = null;
let onSaveCallback = null;

let cropper = null;
let cropCtx = null;

export function openEdit(item, { onSave } = {}) {
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

  document.querySelectorAll('#editModal .mini-field').forEach(el => {
    el.style.display = item.section === 'miniatures' ? 'block' : 'none';
  });

  document.getElementById('editImage').value = '';
  renderEditImages();
  document.getElementById('editModal').classList.add('open');
}

function renderEditImages() {
  const grid = document.getElementById('editImageGrid');
  grid.innerHTML = '';
  editSlots.forEach((slot, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'edit-img-item';
    wrapper.innerHTML = `
      <img src="${slot.src}" alt="" onerror="this.src='/images/default.svg'">
      <button class="edit-img-move-left">&lsaquo;</button>
      <button class="edit-img-move-right">&rsaquo;</button>
      <button class="edit-img-crop">&#9998;</button>
      <button class="edit-img-del">&times;</button>
      <span class="edit-img-idx">#${i + 1}</span>
    `;
    wrapper.querySelector('.edit-img-del').addEventListener('click', () => {
      editSlots.splice(i, 1);
      renderEditImages();
    });
    wrapper.querySelector('.edit-img-crop').addEventListener('click', () => {
      openCrop(slot.src, { slotIdx: i });
    });
    const leftBtn = wrapper.querySelector('.edit-img-move-left');
    const rightBtn = wrapper.querySelector('.edit-img-move-right');
    if (i === 0) leftBtn.disabled = true;
    if (i === editSlots.length - 1) rightBtn.disabled = true;
    leftBtn.addEventListener('click', () => {
      [editSlots[i - 1], editSlots[i]] = [editSlots[i], editSlots[i - 1]];
      renderEditImages();
    });
    rightBtn.addEventListener('click', () => {
      [editSlots[i], editSlots[i + 1]] = [editSlots[i + 1], editSlots[i]];
      renderEditImages();
    });
    grid.appendChild(wrapper);
  });
}

// --- Crop Modal ---
function openCrop(imageSrc, ctx) {
  document.getElementById('cropImage').src = imageSrc;
  document.getElementById('cropModal').classList.add('open');
  setTimeout(() => {
    if (cropper) cropper.destroy();
    cropper = new Cropper(document.getElementById('cropImage'), {
      aspectRatio: NaN,
      viewMode: 1,
      autoCropArea: 0.9,
      background: false,
    });
  }, 200);
  cropCtx = ctx;
}

function closeCrop() {
  if (cropper) { cropper.destroy(); cropper = null; }
  document.getElementById('cropModal').classList.remove('open');
  cropCtx = null;
}

function applyCrop() {
  if (!cropper || !cropCtx) return;
  const canvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });
  const ctx = cropCtx;
  const queue = ctx.newFilesQueue ? [...ctx.newFilesQueue] : null;
  const slotIdx = ctx.slotIdx;

  canvas.toBlob(blob => {
    const file = new File([blob], 'cropped-' + Date.now() + '.jpg', { type: 'image/jpeg' });

    if (typeof slotIdx === 'number' && editSlots[slotIdx]) {
      const slot = editSlots[slotIdx];
      editSlots[slotIdx] = { type: 'replace', originalIdx: slot.originalIdx, file, src: URL.createObjectURL(blob) };
      renderEditImages();
      closeCrop();
      return;
    }

    editSlots.push({ type: 'new', originalIdx: null, file, src: URL.createObjectURL(blob) });
    renderEditImages();

    if (queue && queue.length > 0) {
      closeCrop();
      openCrop(queue.shift(), { newFilesQueue: queue });
    } else {
      closeCrop();
    }
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

  await API.put('/api/items/' + editingId, fd);
  if (onSaveCallback) onSaveCallback();
  closeEdit();
}

function closeEdit() {
  document.getElementById('editModal').classList.remove('open');
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
    const reader = new FileReader();
    const remaining = files.slice(1).map(f => URL.createObjectURL(f));
    reader.onload = (e) => {
      openCrop(e.target.result, { newFilesQueue: remaining });
    };
    reader.readAsDataURL(files[0]);
  });

  document.getElementById('addImagesBtn').addEventListener('click', () => {
    document.getElementById('editImage').click();
  });

  document.getElementById('saveEditBtn').addEventListener('click', saveEdit);

  document.getElementById('cancelEditBtn').addEventListener('click', closeEdit);

  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModal')) closeEdit();
  });
}
