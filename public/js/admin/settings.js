import { API } from '../api.js';

export async function loadSettings() {
  const settings = await API.get('/api/settings');
  document.getElementById('setSiteName').value = settings.siteName || '';
  document.getElementById('currentDefaultImg').textContent = settings.defaultImage || 'not set';
  document.getElementById('setShowSpreadsheet').checked = settings.showSpreadsheet !== false;
  document.getElementById('setShowPublicSpreadsheet').checked = settings.showPublicSpreadsheet !== false;
  const mc = settings.showMiniaturesColumns || {};
  document.getElementById('setShowRecaster').checked = mc.recaster || false;
  document.getElementById('setShowCombatPoints').checked = mc.combatPoints || false;
  document.getElementById('setShowStatus').checked = mc.status || false;
  renderCurrencySettings(settings.currencies || {});
}

async function renderCurrencySettings(currencies) {
  const cats = await API.get('/api/categories');
  const container = document.getElementById('currencySettings');
  container.innerHTML = '';
  Object.entries(cats).forEach(([key, sec]) => {
    const row = document.createElement('div');
    row.className = 'currency-row';
    row.style.cssText = 'margin-bottom:6px;display:flex;align-items:center;gap:8px';
    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'min-width:100px;font-size:0.85rem';
    labelEl.textContent = sec.label;
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.id = 'cur_' + key;
    inputEl.value = currencies[key] || '';
    inputEl.placeholder = '$';
    inputEl.style.cssText = 'width:50px;padding:4px 8px';
    const hint = document.createElement('span');
    hint.style.cssText = 'color:var(--text-muted);font-size:0.78rem';
    hint.textContent = 'symbol';
    row.append(labelEl, inputEl, hint);
    container.appendChild(row);
  });
}

export function initAdminSettings() {
  document.getElementById('backfillBtn').addEventListener('click', async () => {
    const res = await API.post('/api/backfill-defaults');
    alert('Updated ' + res.updated + ' items with default image: ' + res.defaultImage);
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('setDefaultImage');
    if (fileInput.files[0]) {
      const imgFd = new FormData();
      imgFd.append('image', fileInput.files[0]);
      await API.post('/api/upload/default', imgFd);
      fileInput.value = '';
    }
    const currencies = {};
    document.querySelectorAll('#currencySettings .currency-row').forEach(row => {
      const input = row.querySelector('input');
      const sectionId = input.id.replace('cur_', '');
      if (input.value.trim()) currencies[sectionId] = input.value.trim();
    });
    await API.put('/api/settings', {
      siteName: document.getElementById('setSiteName').value,
      showSpreadsheet: document.getElementById('setShowSpreadsheet').checked,
      showPublicSpreadsheet: document.getElementById('setShowPublicSpreadsheet').checked,
      showMiniaturesColumns: {
        recaster: document.getElementById('setShowRecaster').checked,
        combatPoints: document.getElementById('setShowCombatPoints').checked,
        status: document.getElementById('setShowStatus').checked,
      },
      currencies: currencies,
    });
    alert('Settings saved!');
    loadSettings();
  });
}
