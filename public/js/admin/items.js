import { API, withPending } from '../api.js';
import { openEdit, initImageEditor } from '../image-editor.js';

let categoriesData = {};
let extraFieldsSections = ['miniatures'];

export async function initAdminItems() {
  categoriesData = await API.get('/api/categories');
  try {
    const settings = await API.get('/api/settings');
    if (settings.sectionsWithExtraFields) extraFieldsSections = settings.sectionsWithExtraFields;
  } catch {}
  populateCatSectionDropdown(categoriesData);
  populateAddSectionDropdown(categoriesData);
  loadCatList();

  initImageEditor();

  // Add Item form submit
  document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const section = document.getElementById('addSection').value;
    const category = document.getElementById('addCategory').value;
    const title = document.getElementById('addTitle').value.trim();
    const author = document.getElementById('addAuthor').value.trim();
    const price = document.getElementById('addPrice').value;
    const recaster = document.getElementById('addRecaster').value.trim();
    const combatPoints = document.getElementById('addCombatPoints').value.trim();
    const status = document.getElementById('addStatus').value.trim();
    const fileInput = document.getElementById('addImage');
    const files = fileInput.files;

    if (!section) return alert('Select a section');
    if (!category) return alert('Select a category');
    if (!title) return alert('Enter a title');

    const fd = new FormData();
    fd.append('section', section);
    fd.append('category', category);
    fd.append('title', title);
    fd.append('author', author);
    fd.append('price', price);
    fd.append('recaster', recaster);
    fd.append('combatPoints', combatPoints);
    fd.append('status', status);
    for (const f of files) fd.append('images', f);

    const btn = e.target.querySelector('button[type="submit"]');
    try {
      await withPending(btn, () => API.post('/api/items', fd));
      e.target.reset();
      document.getElementById('addCategory').innerHTML = '<option value="">Select section first</option>';
      alert('Item added');
    } catch (err) {
      alert('Failed to add item: ' + (err.message || 'Unknown error'));
    }
  });

  // Tab switching
  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'spreadsheet') loadSpreadsheet();
      if (btn.dataset.tab === 'settings') import('./settings.js').then(m => m.loadSettings());
      if (btn.dataset.tab === 'activity') loadActivity();
    });
  });

  // Hash-based tab navigation

  // Hash-based tab navigation
  const hash = location.hash.slice(1);
  if (hash) {
    const tab = document.querySelector(`[data-tab="${hash}"]`);
    if (tab) tab.click();
  }

  // Add Item section → category handler
  document.getElementById('addSection').addEventListener('change', function() {
    populateCategoryDropdown(this.value);
  });

  // Add Subcategory section handler
  document.getElementById('catSection').addEventListener('change', function() {
    const parentSel = document.getElementById('catParent');
    parentSel.innerHTML = '<option value="">(root of section)</option>';
    const section = this.value;
    if (!section || !categoriesData[section]) return;
    categoriesData[section].subcategories.forEach(c => {
      if (c.type === 'group' && c.subcategories) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label;
        parentSel.appendChild(opt);
      }
    });
  });

  // Add New Section
  document.getElementById('addSectionBtn').addEventListener('click', async () => {
    try {
    await withPending(document.getElementById('addSectionBtn'), async () => {
      const label = document.getElementById('newSectionLabel').value.trim();
      if (!label) return alert('Enter a section name');
      const id = document.getElementById('newSectionId').value.trim() || undefined;
      await API.post('/api/categories', { label, id, parentId: '__new_section__' });
      document.getElementById('newSectionLabel').value = '';
      document.getElementById('newSectionId').value = '';
      categoriesData = await API.get('/api/categories');
      populateCatSectionDropdown(categoriesData);
      populateAddSectionDropdown(categoriesData);
      loadCatList();
      const addSection = document.getElementById('addSection').value;
      if (addSection) {
        document.getElementById('addSection').dispatchEvent(new Event('change'));
      }
    });
    } catch (err) {
      console.error('Failed to add section:', err);
      alert('Failed to add section');
    }
  });

  // Add Subcategory
  document.getElementById('addSubcatBtn').addEventListener('click', async () => {
    try {
    await withPending(document.getElementById('addSubcatBtn'), async () => {
      const section = document.getElementById('catSection').value;
      const parentId = document.getElementById('catParent').value;
      const label = document.getElementById('catLabel').value.trim();
      if (!section) return alert('Select a section');
      if (!label) return alert('Enter a category label');
      const id = document.getElementById('catId').value.trim() || undefined;
      const isGroup = document.getElementById('catIsGroup').checked;
      await API.post('/api/categories', { section, label, id, parentId: parentId || undefined, isGroup });
      document.getElementById('catLabel').value = '';
      document.getElementById('catId').value = '';
      document.getElementById('catIsGroup').checked = false;
      categoriesData = await API.get('/api/categories');
      populateCatSectionDropdown(categoriesData);
      populateAddSectionDropdown(categoriesData);
      loadCatList();
      const addSection = document.getElementById('addSection').value;
      if (addSection) {
        document.getElementById('addSection').dispatchEvent(new Event('change'));
      }
    });
    } catch (err) {
      console.error('Failed to add subcategory:', err);
      alert('Failed to add subcategory');
    }
  });
}

function getCategoryLabel(sectionId, catId) {
  const sec = categoriesData[sectionId];
  if (!sec) {
    console.warn('Section not found in categoriesData:', sectionId);
    return catId;
  }
  for (const c of sec.subcategories) {
    if (c.id === catId) return c.label;
    if (c.type === 'group' && c.subcategories) {
      for (const sc of c.subcategories) {
        if (sc.id === catId) return c.label + ' \u2192 ' + sc.label;
      }
    }
  }
  return catId;
}

function createCell(text, className) {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.textContent = text || '';
  return td;
}

async function loadSpreadsheet() {
  const tbody = document.getElementById('spreadsheetBody');
  if (!tbody) return;
  try {
    const items = await API.get('/api/spreadsheet');
    tbody.innerHTML = '';

  const sprCols = 9;

  if (items.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = sprCols;
    td.style.cssText = 'text-align:center;color:var(--text-muted);padding:40px';
    td.textContent = 'No items';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  const groups = {};
  items.forEach(item => {
    const sec = item.section || '';
    const cat = item.category || '';
    if (!groups[sec]) groups[sec] = {};
    if (!groups[sec][cat]) groups[sec][cat] = [];
    groups[sec][cat].push(item);
  });
  Object.entries(groups).forEach(([secId, cats]) => {
    const secLabel = categoriesData[secId]?.label || secId;
    const secRow = document.createElement('tr');
    secRow.className = 'spr-section-divider';
    const secTd = document.createElement('td');
    secTd.colSpan = sprCols;
    secTd.textContent = secLabel;
    secRow.appendChild(secTd);
    tbody.appendChild(secRow);
    Object.entries(cats).forEach(([catId, catItems]) => {
      const catLabel = getCategoryLabel(secId, catId);
      const catRow = document.createElement('tr');
      catRow.className = 'spr-cat-divider';
      const catTd = document.createElement('td');
      catTd.colSpan = sprCols;
      catTd.textContent = catLabel;
      catRow.appendChild(catTd);
      tbody.appendChild(catRow);
      catItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.appendChild(createCell(item.title));
        tr.appendChild(createCell(item.author));
        tr.appendChild(createCell(item.price));
        tr.appendChild(createCell(item.recaster));
        tr.appendChild(createCell(item.combatPoints));
        tr.appendChild(createCell(item.status));
        tr.appendChild(createCell(item.section));
        tr.appendChild(createCell(item.category));

        const actionsTd = document.createElement('td');
        actionsTd.className = 'actions-cell';
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm edit-spr-btn';
        editBtn.textContent = '\u270f\ufe0f';
        editBtn.addEventListener('click', () => openEdit(item, { onSave: loadSpreadsheet }));
        actionsTd.appendChild(editBtn);
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-sm btn-danger del-spr-btn';
        delBtn.textContent = '\ud83d\uddd1\ufe0f';
        delBtn.addEventListener('click', async () => {
          if (!confirm('Delete "' + item.title + '"?')) return;
          try {
            await withPending(delBtn, () => API.del('/api/items/' + item.id));
            loadSpreadsheet();
          } catch (err) {
            alert('Delete failed: ' + (err.message || 'Unknown error'));
          }
        });
        actionsTd.appendChild(delBtn);
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
      });
    });
  });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Failed to load spreadsheet</td></tr>';
  }
}

function populateAddSectionDropdown(cats) {
  const sel = document.getElementById('addSection');
  sel.innerHTML = '<option value="">Select section...</option>';
  Object.entries(cats).forEach(function (_ref) {
    const key = _ref[0], sec = _ref[1];
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = sec.label;
    sel.appendChild(opt);
  });
}

function populateCatSectionDropdown(cats) {
  const sel = document.getElementById('catSection');
  sel.innerHTML = '<option value="">Select section...</option>';
  Object.entries(cats).forEach(([key, sec]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = sec.label;
    sel.appendChild(opt);
  });
}

function populateCategoryDropdown(section) {
  const sel = document.getElementById('addCategory');
  sel.innerHTML = '<option value="">Select section first</option>';
  if (!section || !categoriesData[section]) return;
  sel.innerHTML = '<option value="">Select category...</option>';
  categoriesData[section].subcategories.forEach(c => {
    if (c.type === 'group' && c.subcategories) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label + ' (group)';
      sel.appendChild(opt);
      c.subcategories.forEach(sc => {
        const opt2 = document.createElement('option');
        opt2.value = sc.id;
        opt2.textContent = '  \u21B3 ' + sc.label;
        sel.appendChild(opt2);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      sel.appendChild(opt);
    }
  });
}

async function deleteCat(section, id, parentId) {
  if (!confirm('Delete "' + (parentId ? 'nested ' : '') + 'category"?')) return;
  const params = new URLSearchParams({ section, ...(id && { id }), ...(parentId && { parentId }) });
  try {
    await API.del('/api/categories?' + params.toString());
    loadCatList();
  } catch (err) {
    alert(err.message || 'Delete failed');
  }
}

async function deleteSection(key) {
  if (!confirm('Delete entire section "' + key + '" and all its subcategories?')) return;
  const params = new URLSearchParams({ section: key });
  try {
    await API.del('/api/categories?' + params.toString());
    loadCatList();
  } catch (err) {
    alert(err.message || 'Delete failed');
  }
}

async function loadCatList() {
  const data = await API.get('/api/categories');
  categoriesData = data;
  populateCatSectionDropdown(data);
  populateAddSectionDropdown(data);
  const div = document.getElementById('catList');
  div.innerHTML = '';
  Object.entries(data).forEach(([key, sec]) => {
    const h4 = document.createElement('h4');
    h4.style.cssText = 'font-weight:400;margin:12px 0 4px;color:var(--accent);font-size:1rem;display:flex;align-items:center;gap:8px';
    const sectionLink = document.createElement('a');
    sectionLink.href = '/' + key;
    sectionLink.textContent = sec.label;
    sectionLink.style.cssText = 'color:var(--accent);text-decoration:none';
    h4.appendChild(sectionLink);
    const delSectionBtn = document.createElement('button');
    delSectionBtn.textContent = '\ud83d\uddd1\ufe0f';
    delSectionBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.85rem;opacity:0.5';
    delSectionBtn.title = 'Delete section';
    delSectionBtn.addEventListener('click', () => deleteSection(key));
    h4.appendChild(delSectionBtn);
    div.appendChild(h4);
    const ul = document.createElement('ul');
    ul.style.cssText = 'list-style:none;padding:0;margin:0';
    sec.subcategories.forEach(c => {
      const li = document.createElement('li');
      li.style.cssText = 'padding:4px 0;font-size:0.9rem;color:var(--text-muted);display:flex;align-items:center;gap:6px';
      if (c.type === 'group' && c.subcategories) {
        li.style.color = 'var(--accent-dark)';
        li.appendChild(document.createTextNode(c.label + ' (group)'));
        const delGroupBtn = document.createElement('button');
        delGroupBtn.textContent = '\ud83d\uddd1\ufe0f';
        delGroupBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.8rem;opacity:0.5';
        delGroupBtn.title = 'Delete group';
        delGroupBtn.addEventListener('click', () => deleteCat(key, c.id, null));
        li.appendChild(delGroupBtn);
        ul.appendChild(li);
        const subUl = document.createElement('ul');
        subUl.style.cssText = 'list-style:none;padding:0 0 0 16px;margin:0 0 4px 0';
        c.subcategories.forEach(sc => {
          const subLi = document.createElement('li');
          subLi.style.cssText = 'padding:2px 0;font-size:0.85rem;color:var(--text-muted);display:flex;align-items:center;gap:6px';
          subLi.appendChild(document.createTextNode(sc.label));
          const delSubBtn = document.createElement('button');
          delSubBtn.textContent = '\ud83d\uddd1\ufe0f';
          delSubBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.75rem;opacity:0.5';
          delSubBtn.title = 'Delete subcategory';
          delSubBtn.addEventListener('click', () => deleteCat(key, sc.id, c.id));
          subLi.appendChild(delSubBtn);
          subUl.appendChild(subLi);
        });
        ul.appendChild(subUl);
      } else {
        li.appendChild(document.createTextNode(c.label));
        const delBtn = document.createElement('button');
        delBtn.textContent = '\ud83d\uddd1\ufe0f';
        delBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.8rem;opacity:0.5';
        delBtn.title = 'Delete category';
        delBtn.addEventListener('click', () => deleteCat(key, c.id, null));
        li.appendChild(delBtn);
        ul.appendChild(li);
      }
    });
    div.appendChild(ul);
  });
}

async function loadActivity() {
  const tbody = document.getElementById('activityBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Loading...</td></tr>';
  try {
    const logs = await API.get('/api/audit');
    if (logs.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No activity yet</td></tr>'; return; }
    tbody.innerHTML = '';
    logs.forEach(log => {
      const tr = document.createElement('tr');
      const time = document.createElement('td');
      time.textContent = new Date(log.timestamp).toLocaleString();
      tr.appendChild(time);
      const action = document.createElement('td');
      action.textContent = log.action || 'unknown';
      tr.appendChild(action);
      const details = document.createElement('td');
      const detailParts = [];
      if (log.title) detailParts.push('title: ' + log.title);
      if (log.entityId) detailParts.push('id: ' + log.entityId);
      if (log.updated !== undefined) detailParts.push('updated: ' + log.updated);
      if (log.section) detailParts.push('section: ' + log.section);
      if (log.categoryId) detailParts.push('category: ' + log.categoryId);
      details.textContent = detailParts.join(', ') || '-';
      details.className = 'mini-col';
      tr.appendChild(details);
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Failed to load activity log</td></tr>';
  }
}
